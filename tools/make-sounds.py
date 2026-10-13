#!/usr/bin/env python3
"""
Synthesizes the module's sound effects (sounds/*.ogg) for the dice trails.

Every sound theme has two files:
  <theme>-loop.ogg   a seamless loop played while a die with that trail flies (quiet, follows its speed)
  <theme>-hit.ogg    a one-shot played when the die bounces or lands (loud, scaled by the impact)

Everything is made from scratch here out of noise, sine waves, filters and envelopes: no recordings
and no third-party samples go in, so the output is free of any licence and is dedicated to the
public domain (CC0 1.0), see sounds/LICENSE-CC0-generated.txt.

Run from the repository root:  python3 tools/make-sounds.py
Needs numpy and ffmpeg (for the OGG Vorbis encoding). The random generator is seeded, so the
files come out the same every time.
"""

import os
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
import zlib

import numpy as np

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sounds")
SR = 44100          # synthesis rate; the files are encoded at 32 kHz mono
LOOP = 3.0          # seconds of every flight loop
rng = np.random.default_rng(11)

# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------


def n_of(d):
    return int(round(d * SR))


def times(d):
    return np.arange(n_of(d)) / SR


def silence(d):
    return np.zeros(n_of(d))


def white(d):
    return rng.standard_normal(n_of(d))


def shape(x, fn):
    """Filter x by multiplying its spectrum with fn(f), f in Hz (array). Non-causal, fine for synthesis."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) * fn(f), n)


def lowpass(x, fc, order=2):
    return shape(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=2):
    return shape(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bandpass(x, lo, hi, order=2):
    return highpass(lowpass(x, hi, order), lo, order)


def peak_filter(x, fc, q=8, gain=1.0):
    """Add a resonant peak at fc on top of x (a cheap resonator)."""
    bw = fc / q
    return x + gain * shape(x, lambda f: np.exp(-((f - fc) / bw) ** 2))


def tilt(x, db_per_octave):
    """Spectral tilt around 1 kHz: -3 dB/oct turns white noise pink, -6 brown."""
    return shape(x, lambda f: (np.maximum(f, 20) / 1000) ** (db_per_octave / 6.02))


def pink(d):
    return tilt(white(d), -3)


def brown(d):
    return tilt(white(d), -6)


def decay(d, tau, attack=0.002):
    """Exponential decay with a short attack."""
    t = times(d)
    a = np.minimum(1, t / max(attack, 1e-4))
    return a * np.exp(-t / tau)


def envelope(d, attack=0.01, hold=0.0, release=0.2, curve=1.0):
    """Attack - hold - release (linear in, power-curved out)."""
    n = n_of(d)
    na, nh = n_of(attack), n_of(hold)
    nr = max(1, n - na - nh)
    e = np.concatenate([np.linspace(0, 1, na, endpoint=False), np.ones(nh), np.linspace(1, 0, nr) ** curve])
    return e[:n] if len(e) >= n else np.concatenate([e, np.zeros(n - len(e))])


def fade(x, d_in=0.005, d_out=0.02):
    n = len(x)
    ni, no = min(n, n_of(d_in)), min(n, n_of(d_out))
    if ni:
        x[:ni] *= np.linspace(0, 1, ni)
    if no:
        x[-no:] *= np.linspace(1, 0, no)
    return x


def smooth_random(d, rate, lo=0.0, hi=1.0, seedless=False):
    """A slowly wandering random value: random points `rate` times a second, smoothly joined."""
    n = n_of(d)
    k = max(2, int(d * rate) + 2)
    pts = rng.uniform(lo, hi, k)
    x = np.linspace(0, k - 1, n)
    i = np.floor(x).astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    return pts[np.minimum(i, k - 1)] * (1 - f) + pts[np.minimum(i + 1, k - 1)] * f


def lfo(d, hz, phase=0.0):
    return np.sin(2 * np.pi * hz * times(d) + phase)


def sine(freq, d, phase=0.0):
    """freq is a number or an array of instantaneous frequencies."""
    t = times(d)
    if np.isscalar(freq):
        return np.sin(2 * np.pi * freq * t + phase)
    return np.sin(2 * np.pi * np.cumsum(np.asarray(freq)) / SR + phase)


def glide(f0, f1, d, curve=1.0):
    """A frequency curve from f0 to f1 (exponential in pitch)."""
    t = np.linspace(0, 1, n_of(d)) ** curve
    return f0 * (f1 / f0) ** t


def vibrato(freq, d, rate, depth):
    """A frequency curve with vibrato (depth as a fraction of the frequency)."""
    return freq * (1 + depth * lfo(d, rate))


def harmonics(freq, d, amps):
    out = silence(d)
    for i, a in enumerate(amps, start=1):
        out += a * sine(freq * i if np.isscalar(freq) else np.asarray(freq) * i, d, rng.uniform(0, 6.28))
    return out


def partials(base, ratios, amps, taus, d, attack=0.001):
    """A struck object: sines at base*ratio that each decay at their own rate (bells, metal, glass)."""
    out = silence(d)
    for r, a, tau in zip(ratios, amps, taus):
        out += a * sine(base * r, d, rng.uniform(0, 6.28)) * decay(d, tau, attack)
    return out


def pluck(freq, d, bright=0.5, tau=0.4):
    """A plucked string: harmonics that decay faster the higher they are."""
    out = silence(d)
    for i in range(1, 9):
        a = bright ** (i - 1) / i
        out += a * sine(freq * i, d) * decay(d, tau / (1 + 0.6 * (i - 1)), 0.001)
    return out


def fft_convolve(a, b):
    n = len(a) + len(b) - 1
    return np.fft.irfft(np.fft.rfft(a, n) * np.fft.rfft(b, n), n)


def reverb(x, size=0.5, tau=0.25, mix=0.3, tone=5000):
    """A small reverb: convolution with a decaying, lowpassed noise tail."""
    ir = lowpass(white(size), tone) * decay(size, tau, 0.0005)
    ir /= np.sqrt(np.sum(ir ** 2)) * 3
    wet = fft_convolve(x, ir)[: len(x)]
    return x * (1 - mix) + wet * mix


def loopify(x, xfade=0.25):
    """Make x loop seamlessly: its tail is faded into its head and cut off."""
    k = n_of(xfade)
    n = len(x)
    out = x[: n - k].copy()
    up = np.linspace(0, 1, k)
    out[:k] = x[:k] * up + x[n - k:] * (1 - up)
    return out


def normalize(x, peak=0.9):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def loudness(x, window=0.05):
    """The loudest short-term RMS of x (over `window` seconds), a fair measure for clicks and drones alike."""
    k = n_of(window)
    sq = np.convolve(x * x, np.ones(k) / k, mode="valid")
    return np.sqrt(np.max(sq)) if len(sq) else 0.0


def level(x, rms, peak=0.95):
    """Bring x to a short-term loudness of `rms`, soft-limiting whatever would then exceed `peak`."""
    l = loudness(x)
    if l > 0:
        x = x * (rms / l)
    m = np.max(np.abs(x))
    return soft_clip(x / m, 1.0) * peak if m > peak else x


def soft_clip(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


def place(buf, snd, at, gain=1.0):
    """Add snd into buf starting at time `at` (seconds), clipped to buf."""
    i = n_of(at)
    if i >= len(buf):
        return buf
    m = min(len(snd), len(buf) - i)
    buf[i : i + m] += snd[:m] * gain
    return buf


def sprinkle(d, count, maker, lo=0.0, hi=None, density=None):
    """Scatter `count` short sounds made by maker() over d seconds (density(t) 0..1 weights where they fall)."""
    hi = d if hi is None else hi
    buf = silence(d)
    for _ in range(count):
        at = rng.uniform(lo, hi)
        if density is not None and rng.uniform() > density(at):
            continue
        place(buf, maker(), at)
    return buf


def crackle(lo=1500, hi=7000, length=(0.006, 0.03), gain=(0.3, 1.0)):
    ln = rng.uniform(*length)
    return bandpass(white(ln), lo, hi) * decay(ln, ln / 3) * rng.uniform(*gain)


def bubble(f0=(300, 900), rise=1.8, length=(0.03, 0.08), gain=(0.3, 1.0)):
    ln = rng.uniform(*length)
    f = rng.uniform(*f0)
    return sine(glide(f, f * rise, ln), ln) * decay(ln, ln / 2.5, 0.003) * rng.uniform(*gain)


def ping(f0=(2000, 6000), length=(0.05, 0.2), gain=(0.2, 0.8)):
    ln = rng.uniform(*length)
    return sine(rng.uniform(*f0), ln) * decay(ln, ln / 3, 0.001) * rng.uniform(*gain)


def whoosh(d, lo=200, hi=3000, peak=0.35, width=0.3):
    """A noise swell whose brightness rises and falls with it."""
    t = times(d)
    e = np.exp(-((t - peak * d) / (width * d)) ** 2)
    x = bandpass(white(d), lo, hi) * e
    bright = highpass(white(d), hi * 0.7) * e ** 2 * 0.5
    return x + bright


# ---------------------------------------------------------------------------
# The themes: each returns (loop, hit)
# ---------------------------------------------------------------------------


def pop(f0=(250, 700), length=(0.008, 0.02), gain=(0.3, 1.0)):
    """A wood pop in a fire: a tiny resonant knock with a bright snap on top."""
    ln = rng.uniform(*length)
    f = rng.uniform(*f0)
    knock = sine(glide(f * 1.4, f, ln), ln) * decay(ln, ln / 3, 0.0003)
    snap = highpass(white(ln), 3000) * decay(ln, ln / 6, 0.0002) * 0.6
    return (knock + snap) * rng.uniform(*gain)


def theme_fire():
    """A real fire: a breathing roar of flame, hiss, and wood crackling and popping at every size."""
    d = LOOP
    flicker = (0.35 + 0.65 * smooth_random(d, 9)) * (0.6 + 0.4 * smooth_random(d, 2.5))   # fast licks over slow breathing
    roar = highpass(lowpass(pink(d), 700, 1), 60) * flicker
    hiss = bandpass(white(d), 2500, 9000, 1) * (0.3 + 0.7 * smooth_random(d, 6)) * 0.22
    snaps = sprinkle(d, 110, lambda: crackle(2000, 10000, (0.003, 0.018), (0.15, 0.7)))   # small, constant crackle
    pops = sprinkle(d, 14, lambda: pop((250, 700), (0.01, 0.025), (0.5, 1.0)))             # bigger pops now and then
    loop = roar * 0.95 + hiss + snaps * 0.5 + pops * 0.8

    # The hit: a flare-up, a "whumpf" of flame with a shower of crackles and pops.
    h = 0.9
    whumpf = lowpass(pink(h), 500) * envelope(h, 0.035, 0.03, 0.5, 1.4)
    flare = whoosh(h, 200, 3500, peak=0.1, width=0.2) * 0.9
    burst = bandpass(white(h), 1000, 8000) * decay(h, 0.08, 0.004) * 0.6
    thump = sine(glide(140, 55, h), h) * decay(h, 0.1, 0.002) * 0.7
    shower = sprinkle(h, 45, lambda: crackle(2000, 10000, (0.003, 0.018), (0.2, 0.8)), density=lambda t: np.exp(-t / 0.3))
    bigpops = sprinkle(h, 7, lambda: pop((200, 600), (0.012, 0.03), (0.6, 1.0)), density=lambda t: np.exp(-t / 0.35))
    hit = whumpf * 1.1 + flare + burst + thump + shower * 0.6 + bigpops * 0.9
    return loop, hit


def ice_crack(gain=(0.3, 1.0)):
    """A crack running through ice: a sharp snap that rings glassy for a moment."""
    ln = rng.uniform(0.04, 0.14)
    snap = highpass(white(ln), 2500) * decay(ln, 0.004, 0.0002)
    ring = partials(rng.uniform(1800, 3200), [1, 1.5, 2.3], [1, 0.4, 0.2], [ln / 3, ln / 4, ln / 5], ln, 0.0003) * 0.5
    return (snap + ring) * rng.uniform(*gain)


def ice_pew(gain=(0.3, 0.8)):
    """The chirp of a crack racing across a frozen lake: a tone that slides down as it spreads."""
    ln = rng.uniform(0.12, 0.35)
    f = rng.uniform(1800, 3500)
    return sine(glide(f, f * 0.22, ln, 0.6), ln) * decay(ln, ln / 3, 0.002) * rng.uniform(*gain)


def theme_frost():
    """Crackling ice: crystals forming in a fine crackle, cracks snapping and ringing, and the odd lake-ice chirp."""
    d = LOOP
    freeze = sprinkle(d, 160, lambda: crackle(3000, 12000, (0.002, 0.008), (0.1, 0.45)))   # crystals forming
    cracks = sprinkle(d, 26, ice_crack)
    pews = sprinkle(d, 5, ice_pew)
    chill = bandpass(white(d), 2000, 9000, 1) * (0.2 + 0.8 * smooth_random(d, 1.2)) * 0.18   # a cold wind
    loop = reverb(freeze * 0.6 + cracks * 0.9 + pews * 0.7 + chill, 0.5, 0.25, 0.25)

    # The hit: the ice breaks, a snap, the crack racing away, and a shower of shards.
    h = 1.0
    snap = white(h) * decay(h, 0.005, 0.0002)
    crack = highpass(white(h), 2000) * decay(h, 0.03, 0.0003)
    pew = sine(glide(3200, 600, h, 0.6), h) * decay(h, 0.1, 0.001) * 0.8
    glass = partials(2200, [1, 1.41, 2.27, 3.12, 4.5], [1, 0.7, 0.5, 0.35, 0.2], [0.35, 0.28, 0.2, 0.15, 0.1], h)
    shatter = sprinkle(h, 50, lambda: ice_crack((0.2, 0.7)), density=lambda t: np.exp(-t / 0.25))
    body = lowpass(white(h), 400) * decay(h, 0.05, 0.001) * 0.5
    hit = reverb(snap * 1.0 + crack * 0.9 + pew + glass * 0.6 + shatter * 0.6 + body, 0.6, 0.3, 0.3)
    return loop, hit


def theme_lightning():
    """A lightning rod: a taut, crackling charge in the air, and a strike that is all over in a blink."""
    d = LOOP
    static = highpass(white(d), 3000) * smooth_random(d, 14) ** 2 * 0.5
    hum = (sine(120, d) * 0.5 + sine(240, d) * 0.3 + sine(360, d) * 0.15) * (0.5 + 0.5 * smooth_random(d, 8)) * 0.2
    arcs = sprinkle(d, 55, lambda: crackle(2500, 14000, (0.002, 0.012), (0.5, 1.0)))
    loop = static + hum + arcs * 0.8

    # The strike: everything happens in the first 20 ms, no reverb to smear it.
    h = 0.45
    snap = white(h) * decay(h, 0.004, 0.0002)                                   # the instantaneous full-band crack
    edge = highpass(white(h), 2500) * decay(h, 0.018, 0.0002)                    # its sharp, bright edge
    clap = lowpass(white(h), 350) * decay(h, 0.06, 0.0005)                       # the power: a tight low clap
    sub = sine(glide(130, 45, h, 0.4), h) * decay(h, 0.07, 0.0005)               # the thump in the chest
    rod = partials(3600, [1, 1.47, 2.09, 2.8], [1, 0.6, 0.4, 0.25], [0.09, 0.07, 0.05, 0.04], h, 0.0002)   # the rod rings for a blink
    arc = highpass(white(h), 4000) * decay(h, 0.05, 0.001) * (0.5 + 0.5 * (lfo(h, 120) > 0))                # a short sizzle after
    hit = soft_clip(snap * 1.3 + edge * 1.0 + clap * 1.2 + sub * 1.0 + rod * 0.5 + arc * 0.6, 1.6)
    return loop, hit


def theme_thunder():
    d = LOOP
    rumble = lowpass(brown(d), 140, 2) * (0.5 + 0.5 * smooth_random(d, 4))
    loop = highpass(rumble, 30) * 1.2

    h = 1.4
    crack = bandpass(white(h), 400, 5000) * decay(h, 0.03, 0.0005)
    boom = lowpass(white(h), 180, 2) * decay(h, 0.35, 0.01)
    sub = sine(glide(70, 40, h), h) * decay(h, 0.3, 0.005)
    roll = lowpass(brown(h), 250) * envelope(h, 0.15, 0.1, 1.1, 1.5) * (0.6 + 0.4 * smooth_random(h, 6))
    hit = soft_clip(crack * 0.7 + boom * 1.1 + sub * 1.0 + roll * 0.9, 1.3)
    return loop, hit


def theme_acid():
    d = LOOP
    sizzle = bandpass(white(d), 2500, 11000) * (0.4 + 0.6 * smooth_random(d, 12)) * 0.5
    bubbles = sprinkle(d, 36, lambda: bubble((500, 1600), 2.2, (0.02, 0.06), (0.2, 0.6)))
    loop = sizzle + bubbles

    h = 0.9
    splash = bandpass(white(h), 800, 9000) * decay(h, 0.09, 0.002)
    fizz = bandpass(white(h), 3000, 12000) * envelope(h, 0.02, 0.1, 0.7, 2) * (0.5 + 0.5 * smooth_random(h, 20))
    pops = sprinkle(h, 24, lambda: bubble((600, 2000), 2.0, (0.02, 0.05)), density=lambda t: np.exp(-t / 0.3))
    hit = splash * 0.9 + fizz * 0.5 + pops * 0.6
    return loop, hit


def blub(f0=(90, 320), length=(0.05, 0.16), gain=(0.3, 1.0)):
    """A thick liquid bubble: a round tone that rises as the bubble grows, then bursts with a wet plop."""
    ln = rng.uniform(*length)
    f = rng.uniform(*f0)
    body = harmonics(glide(f, f * 1.9, ln, 1.4), ln, [1, 0.35, 0.12]) * envelope(ln, ln * 0.15, ln * 0.4, ln * 0.45, 1.3)
    plop = bandpass(white(0.02), 400, 2500) * decay(0.02, 0.006, 0.0005) * 0.5
    out = silence(ln + 0.02)                  # room for the whole plop, even on the shortest bubble
    out[: len(body)] = body
    place(out, plop, ln * 0.88)
    return out * rng.uniform(*gain)


def theme_poison():
    """A cauldron: thick brew bubbling and blurping over a simmer, with wisps of steam."""
    d = LOOP
    simmer = lowpass(pink(d), 1200, 1) * (0.4 + 0.6 * smooth_random(d, 5)) * 0.3
    steam = bandpass(white(d), 2500, 7000, 1) * (0.5 + 0.5 * lfo(d, 0.4)) ** 2 * 0.1
    small = sprinkle(d, 40, lambda: blub((220, 520), (0.03, 0.07), (0.15, 0.5)))      # a fizz of small bubbles
    medium = sprinkle(d, 22, lambda: blub((120, 300), (0.06, 0.13), (0.4, 0.9)))
    big = sprinkle(d, 6, lambda: blub((70, 140), (0.14, 0.24), (0.7, 1.0)))           # the slow, fat blorps
    loop = lowpass(simmer + steam + small + medium + big, 5000)

    # The hit: the brew boils over, a wet surge of big bubbles and a gush of steam.
    h = 1.1
    surge = lowpass(pink(h), 900) * envelope(h, 0.03, 0.08, 0.9, 1.5) * 0.8
    gush = bandpass(white(h), 2000, 7000, 1) * envelope(h, 0.02, 0.15, 0.8, 2) * 0.25
    splash = bandpass(white(h), 300, 3000) * decay(h, 0.07, 0.003) * 0.7
    blorps = sprinkle(h, 10, lambda: blub((70, 180), (0.1, 0.22), (0.6, 1.0)), hi=0.6)
    fizz = sprinkle(h, 30, lambda: blub((200, 500), (0.03, 0.07), (0.2, 0.5)), density=lambda t: np.exp(-t / 0.4))
    hit = lowpass(surge + gush + splash + blorps * 1.0 + fizz * 0.7, 6000)
    return loop, hit


def theme_necrotic():
    d = LOOP
    drone = (sine(55, d) + sine(55.4, d) * 0.8 + sine(110.3, d) * 0.4) * 0.25
    whisper = bandpass(white(d), 300, 2200, 1) * smooth_random(d, 3) ** 2 * 0.35
    wail = sine(vibrato(glide(420, 300, d), d, 5.5, 0.02), d) * (0.5 + 0.5 * lfo(d, 0.33)) ** 3 * 0.18
    loop = reverb(drone + whisper + wail, 0.8, 0.4, 0.4, 3000)

    h = 1.2
    thud = sine(glide(90, 45, h), h) * decay(h, 0.18, 0.004)
    gust = lowpass(pink(h), 1500) * envelope(h, 0.015, 0.05, 0.9, 1.6)
    moan = sine(vibrato(glide(500, 240, h, 0.6), h, 6, 0.03), h) * envelope(h, 0.05, 0.1, 0.8, 1.3) * 0.5
    hit = reverb(thud * 1.0 + gust * 0.8 + moan * 0.7, 0.9, 0.45, 0.4, 3000)
    return loop, hit


def theme_radiant():
    d = LOOP
    chord = sum(sine(vibrato(f, d, 0.2 + i * 0.1, 0.002), d) * a for i, (f, a) in enumerate([(523.25, 0.5), (659.25, 0.4), (783.99, 0.35), (1046.5, 0.25), (1567.98, 0.12)]))
    chord *= 0.35 * (0.7 + 0.3 * lfo(d, 2.5))
    sparkle = sprinkle(d, 22, lambda: ping((2500, 6500), (0.1, 0.35), (0.1, 0.35)))
    loop = reverb(chord + sparkle, 0.6, 0.35, 0.35)

    h = 1.3
    bell = partials(880, [1, 2.0, 2.98, 4.2, 5.4], [1, 0.6, 0.4, 0.25, 0.15], [0.6, 0.45, 0.3, 0.2, 0.12], h)
    burst = highpass(white(h), 2500) * decay(h, 0.05, 0.001) * 0.5
    chime = sprinkle(h, 10, lambda: ping((3000, 8000), (0.1, 0.3), (0.2, 0.5)), lo=0.0, hi=0.3)
    hit = reverb(bell * 0.9 + burst * 0.6 + chime * 0.6, 0.8, 0.5, 0.4)
    return loop, hit


def theme_force():
    d = LOOP
    t = times(d)
    saw = sum(sine(110 * i * (1 + 0.004 * (i % 2)), d) / i for i in range(1, 9))
    saw2 = sum(sine(110.6 * i, d) / i for i in range(1, 9))
    hum = (saw + saw2) * 0.12
    wob = smooth_random(d, 1.2, 300, 1600)
    hum = shape(hum, lambda f: 1 / np.sqrt(1 + (f / 800) ** 4))
    hum = hum * (0.6 + 0.4 * (wob / 1600))
    shimmer = bandpass(white(d), 2000, 6000) * (lfo(d, 0.5) * 0.5 + 0.5) ** 2 * 0.12
    loop = reverb(hum + shimmer, 0.5, 0.3, 0.3)

    h = 0.9
    wub = sine(glide(700, 70, h, 0.6), h) * decay(h, 0.2, 0.003)
    wub2 = sine(glide(1400, 140, h, 0.6), h) * decay(h, 0.12, 0.003) * 0.4
    swoosh = whoosh(h, 500, 6000, peak=0.08, width=0.2) * 0.8
    hit = reverb(soft_clip(wub * 1.0 + wub2 + swoosh, 1.4), 0.6, 0.3, 0.3)
    return loop, hit


def theme_psychic():
    d = LOOP
    a = sine(vibrato(440, d, 6, 0.012), d) * 0.3
    b = sine(vibrato(660, d, 4.3, 0.015), d) * 0.2
    c = sine(vibrato(1320, d, 7.1, 0.01), d) * 0.08 * (0.5 + 0.5 * lfo(d, 0.4))
    warble = (a + b + c) * (0.6 + 0.4 * lfo(d, 1.3))
    loop = reverb(warble, 0.8, 0.45, 0.45)

    h = 1.1
    pingd = sine(glide(1800, 900, h, 0.4), h) * decay(h, 0.25, 0.002)
    ringmod = sine(1200, h) * sine(37, h) * decay(h, 0.3, 0.01) * 0.5
    swirl = bandpass(white(h), 1000, 5000) * envelope(h, 0.05, 0.05, 0.8, 1.8) * (0.5 + 0.5 * lfo(h, 11)) * 0.35
    hit = reverb(pingd * 0.9 + ringmod + swirl, 0.9, 0.5, 0.45)
    return loop, hit


def theme_stone():
    d = LOOP
    grit = lowpass(brown(d), 600, 1) * (0.4 + 0.6 * smooth_random(d, 8)) * 0.9
    pebbles = sprinkle(d, 50, lambda: crackle(400, 3000, (0.004, 0.02), (0.2, 0.7)))
    loop = highpass(grit + pebbles, 40)

    h = 0.9
    thud = lowpass(white(h), 260, 2) * decay(h, 0.07, 0.002)
    knock = bandpass(white(h), 300, 1800) * decay(h, 0.025, 0.0005)
    sub = sine(glide(90, 45, h), h) * decay(h, 0.1, 0.003)
    gravel = sprinkle(h, 40, lambda: crackle(500, 4000, (0.004, 0.02)), density=lambda t: np.exp(-t / 0.2))
    hit = soft_clip(thud * 1.2 + knock * 0.8 + sub * 0.9 + gravel * 0.5, 1.3)
    return loop, hit


def theme_needle():
    d = LOOP
    centre = smooth_random(d, 2, 1800, 3400)
    air = shape(white(d), lambda f: np.exp(-((f - 2600) / 500) ** 2))
    air = air * (0.4 + 0.6 * smooth_random(d, 5)) * 0.6
    whistle = sine(centre, d) * 0.08 * (0.5 + 0.5 * smooth_random(d, 1.5))
    loop = air + whistle

    h = 0.8
    tick = highpass(white(h), 4000) * decay(h, 0.006, 0.0003)
    ting = partials(4200, [1, 1.5, 2.1, 2.9, 3.8], [1, 0.5, 0.4, 0.25, 0.15], [0.25, 0.18, 0.14, 0.1, 0.07], h)
    hit = reverb(tick * 0.9 + ting * 0.8, 0.4, 0.2, 0.25)
    return loop, hit


def theme_blade():
    d = LOOP
    t = times(d)
    swish = sum(whoosh(d, 600, 6000, peak=(0.15 + i * 0.34), width=0.07) for i in range(3)) * 0.7
    ring = (sine(2400, d) + sine(3611, d) * 0.6) * 0.03 * (0.5 + 0.5 * lfo(d, 2.9))
    loop = swish + ring

    h = 1.0
    scrape = bandpass(white(h), 1500, 9000) * decay(h, 0.03, 0.0005)
    clang = partials(1500, [1, 1.5, 2.3, 3.7, 5.1], [1, 0.7, 0.5, 0.3, 0.2], [0.5, 0.35, 0.25, 0.15, 0.1], h)
    schwing = sine(glide(3000, 5000, h, 0.5), h) * decay(h, 0.08, 0.002) * 0.3
    hit = reverb(scrape * 0.9 + clang * 0.9 + schwing, 0.5, 0.25, 0.3)
    return loop, hit


def choir(freq, d, voices=5, detune=0.004, vib=(4.5, 0.006)):
    """A choir-like voice: several slightly detuned, vibrato-laden copies of a tone with vowel-like overtones."""
    out = silence(d)
    for v in range(voices):
        f = freq * (1 + detune * (v - (voices - 1) / 2))
        out += harmonics(vibrato(f, d, vib[0] + 0.3 * v, vib[1]), d, [1, 0.5, 0.25, 0.3, 0.12, 0.08])
    return shape(out / voices, lambda f: np.exp(-((f - 900) / 700) ** 2) * 0.8 + 0.35)   # an "ah" formant


def theme_healing():
    """Holy light: a choir holding a bright major chord under a cathedral's reverb, and a chime of bells."""
    d = LOOP
    chord = [(261.63, 0.5), (392.0, 0.45), (523.25, 0.4), (659.25, 0.3), (783.99, 0.2)]     # C major, open voicing
    pad = sum(choir(f, d) * a for f, a in chord) * 0.3 * (0.8 + 0.2 * lfo(d, 0.5))
    halo = (sine(vibrato(1046.5, d, 0.4, 0.003), d) + sine(vibrato(1318.5, d, 0.3, 0.003), d) * 0.6) * 0.05 * (0.5 + 0.5 * lfo(d, 0.7, 1.0))
    sparkle = sprinkle(d, 12, lambda: ping((3000, 7000), (0.2, 0.5), (0.05, 0.18)))
    loop = reverb(pad + halo + sparkle, 1.5, 0.9, 0.5, 6000)

    h = 1.8
    bells = silence(h)
    for i, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):                       # a rising chime, C E G C
        place(bells, partials(f, [1, 2.0, 2.98, 4.2], [1, 0.4, 0.25, 0.12], [0.9, 0.5, 0.3, 0.2], 1.4, 0.001), i * 0.07, 0.5 - 0.06 * i)
    swell = sum(choir(f, h, 4) * a for f, a in [(523.25, 0.5), (659.25, 0.4), (783.99, 0.3)]) * envelope(h, 0.12, 0.25, 1.4, 1.6) * 0.5
    light = highpass(white(h), 5000) * envelope(h, 0.05, 0.1, 0.8, 2) * 0.12
    hit = reverb(bells * 0.9 + swell + light, 1.6, 1.0, 0.5, 6000)
    return loop, hit


def theme_ward():
    d = LOOP
    hum = (sine(220, d) + sine(330, d) * 0.6 + sine(440, d) * 0.3) * 0.22 * (0.75 + 0.25 * lfo(d, 4))
    shimmer = highpass(white(d), 3000) * (0.5 + 0.5 * lfo(d, 4, 1.5)) ** 2 * 0.1
    loop = reverb(hum + shimmer, 0.5, 0.3, 0.3)

    h = 1.0
    ping_ = partials(1000, [1, 2.76, 5.4, 8.9], [1, 0.6, 0.3, 0.15], [0.45, 0.3, 0.2, 0.12], h)
    resonance = sine(glide(440, 330, h, 0.5), h) * decay(h, 0.35, 0.005) * 0.4
    tick = highpass(white(h), 3000) * decay(h, 0.01, 0.0003) * 0.6
    hit = reverb(ping_ * 0.9 + resonance + tick, 0.6, 0.35, 0.35)
    return loop, hit


def theme_smoke():
    d = LOOP
    hiss = lowpass(pink(d), 3000, 1) * (0.25 + 0.75 * smooth_random(d, 1.3)) * 0.55
    breath = bandpass(white(d), 200, 900) * (0.5 + 0.5 * lfo(d, 0.66)) ** 2 * 0.35
    loop = hiss + breath

    h = 0.9
    puff = lowpass(pink(h), 2200) * envelope(h, 0.02, 0.03, 0.8, 1.6)
    low = lowpass(white(h), 300) * decay(h, 0.08, 0.005) * 0.6
    hit = puff * 1.0 + low
    return loop, hit


def theme_stardust():
    d = LOOP
    twinkle = sprinkle(d, 40, lambda: ping((2500, 9000), (0.05, 0.25), (0.15, 0.6)))
    bed = highpass(white(d), 6000) * (0.5 + 0.5 * smooth_random(d, 3)) * 0.08
    loop = reverb(twinkle + bed, 0.5, 0.3, 0.3)

    h = 1.0
    cluster = silence(h)
    for i, f in enumerate([2093, 2637, 3136, 4186, 5274, 6272]):
        place(cluster, sine(f, 0.5) * decay(0.5, 0.15, 0.001), i * 0.025, 0.5 - 0.05 * i)
    dust = highpass(white(h), 5000) * decay(h, 0.08, 0.002) * 0.4
    hit = reverb(cluster + dust, 0.7, 0.4, 0.4)
    return loop, hit


def theme_comet():
    d = LOOP
    centre = smooth_random(d, 1.5, 500, 1800)
    jet = shape(white(d), lambda f: 1 / (1 + ((f - 1200) / 900) ** 4)) * (0.5 + 0.5 * smooth_random(d, 4)) * 0.7
    rumble = lowpass(brown(d), 200) * 0.6
    loop = highpass(jet + rumble, 40)

    h = 1.0
    swoosh = whoosh(h, 300, 5000, peak=0.1, width=0.22) * 1.0
    boom = lowpass(white(h), 220) * decay(h, 0.14, 0.003)
    sub = sine(glide(80, 45, h), h) * decay(h, 0.16, 0.004)
    hit = soft_clip(swoosh + boom * 1.0 + sub * 0.8, 1.3)
    return loop, hit


def theme_rainbow():
    d = LOOP
    notes = [523.25, 659.25, 783.99, 987.77, 1174.66]
    arp = silence(d)
    step = d / 10
    for i in range(10):
        f = notes[i % 5] if i < 5 else notes[9 - i]
        place(arp, sine(f, step * 2) * envelope(step * 2, 0.02, 0.0, step * 2 - 0.02, 1.5), i * step, 0.3)
    pad = (sine(261.63, d) + sine(392, d) * 0.7) * 0.12 * (0.7 + 0.3 * lfo(d, 1.1))
    loop = reverb(arp + pad, 0.7, 0.4, 0.4)

    h = 1.1
    gliss = silence(h)
    for i, f in enumerate([523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]):
        place(gliss, sine(f, 0.6) * decay(0.6, 0.2, 0.002), i * 0.04, 0.45 - 0.03 * i)
    sparkle = sprinkle(h, 10, lambda: ping((3000, 7000), (0.1, 0.3), (0.2, 0.4)), hi=0.4)
    hit = reverb(gliss + sparkle, 0.8, 0.45, 0.4)
    return loop, hit


def theme_tide():
    d = LOOP
    waves = lowpass(pink(d), 1200, 1) * (0.2 + 0.8 * (0.5 + 0.5 * lfo(d, 0.66)) ** 2)
    foam = bandpass(white(d), 2000, 8000) * (0.5 + 0.5 * lfo(d, 0.66, 1.0)) ** 3 * 0.4
    bubbles = sprinkle(d, 18, lambda: bubble((300, 900), 1.8, (0.03, 0.08), (0.15, 0.4)))
    loop = waves * 0.8 + foam + bubbles

    h = 1.0
    splash = bandpass(white(h), 500, 7000) * decay(h, 0.12, 0.003)
    body = lowpass(white(h), 400) * decay(h, 0.09, 0.004) * 0.9
    drops = sprinkle(h, 22, lambda: bubble((400, 1400), 1.9, (0.02, 0.06)), density=lambda t: np.exp(-t / 0.35))
    hit = splash * 0.9 + body + drops * 0.6
    return loop, hit


def theme_charm():
    d = LOOP
    pad = sum(sine(vibrato(f, d, 0.4 + i * 0.1, 0.004), d) * a for i, (f, a) in enumerate([(440, 0.4), (554.37, 0.35), (659.25, 0.3), (880, 0.2)]))
    pad *= 0.28 * (0.7 + 0.3 * lfo(d, 1.0))
    heart = silence(d)
    for i in range(int(d / 0.85) + 1):
        place(heart, lowpass(white(0.12), 120) * decay(0.12, 0.03, 0.003), i * 0.85, 0.5)
        place(heart, lowpass(white(0.12), 120) * decay(0.12, 0.03, 0.003), i * 0.85 + 0.18, 0.35)
    twinkle = sprinkle(d, 12, lambda: ping((2500, 5000), (0.1, 0.3), (0.08, 0.25)))
    loop = reverb(pad + twinkle, 0.7, 0.4, 0.35) + heart

    h = 1.1
    bell = partials(1760, [1, 1.5, 2.0, 2.5], [1, 0.5, 0.4, 0.2], [0.35, 0.25, 0.2, 0.12], h)
    slide = sine(glide(880, 1320, h, 0.5), h) * envelope(h, 0.03, 0.05, 0.6, 1.5) * 0.35
    pop = lowpass(white(h), 1200) * decay(h, 0.015, 0.001) * 0.6
    hit = reverb(bell * 0.8 + slide + pop, 0.7, 0.4, 0.4)
    return loop, hit


def theme_petals():
    d = LOOP
    breeze = lowpass(pink(d), 1800, 1) * (0.2 + 0.8 * (0.5 + 0.5 * smooth_random(d, 0.8)) ** 2) * 0.6
    rustle = sprinkle(d, 90, lambda: crackle(2500, 9000, (0.003, 0.012), (0.1, 0.4)))
    loop = breeze + rustle

    h = 0.8
    gust = lowpass(pink(h), 2500) * envelope(h, 0.02, 0.04, 0.7, 1.6) * 0.8
    leaves = sprinkle(h, 60, lambda: crackle(2500, 9000, (0.003, 0.012), (0.2, 0.6)), density=lambda t: np.exp(-t / 0.25))
    hit = gust + leaves
    return loop, hit


def theme_song():
    d = LOOP
    melody = [(392, 0.0), (493.88, 0.5), (587.33, 1.0), (783.99, 1.5), (587.33, 2.0), (493.88, 2.5)]
    tune = silence(d)
    for f, at in melody:
        note = sine(vibrato(f, 0.55, 5.5, 0.008), 0.55) * envelope(0.55, 0.03, 0.2, 0.3, 1.5)
        note += sine(f * 2, 0.55) * envelope(0.55, 0.03, 0.2, 0.3, 1.5) * 0.3
        place(tune, note, at, 0.3)
    loop = reverb(tune, 0.8, 0.45, 0.4)

    h = 1.3
    strum = silence(h)
    for i, f in enumerate([392, 493.88, 587.33, 783.99]):
        place(strum, pluck(f, 1.0, 0.6, 0.6), i * 0.035, 0.6 - 0.08 * i)
    hit = reverb(strum, 0.8, 0.5, 0.4)
    return loop, hit


THEMES = {
    "fire": theme_fire, "frost": theme_frost, "lightning": theme_lightning, "thunder": theme_thunder,
    "acid": theme_acid, "poison": theme_poison, "necrotic": theme_necrotic, "radiant": theme_radiant,
    "force": theme_force, "psychic": theme_psychic, "stone": theme_stone, "needle": theme_needle,
    "blade": theme_blade, "healing": theme_healing, "ward": theme_ward, "smoke": theme_smoke,
    "stardust": theme_stardust, "comet": theme_comet, "rainbow": theme_rainbow, "tide": theme_tide,
    "charm": theme_charm, "petals": theme_petals, "song": theme_song
}

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav, ogg):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-fflags", "+bitexact", "-flags", "+bitexact", "-i", wav,
                    "-ar", "32000", "-ac", "1", "-c:a", "libvorbis", "-q:a", "2", ogg], check=True)
    fix_ogg_serial(ogg, zlib.crc32(os.path.basename(ogg).encode()))


OGG_CRC = []
for _i in range(256):
    _r = _i << 24
    for _ in range(8):
        _r = ((_r << 1) ^ 0x04C11DB7) if _r & 0x80000000 else (_r << 1)
    OGG_CRC.append(_r & 0xFFFFFFFF)


def ogg_crc(data):
    r = 0
    for b in data:
        r = ((r << 8) & 0xFFFFFFFF) ^ OGG_CRC[((r >> 24) ^ b) & 0xFF]
    return r


def fix_ogg_serial(path, serial):
    """
    Give the file's Ogg stream a fixed serial number (ffmpeg picks a random one, which made every
    regeneration rewrite all 46 files) and recompute each page's checksum. The audio is untouched.
    """
    d = bytearray(open(path, "rb").read())
    i = 0
    while i < len(d):
        if d[i : i + 4] != b"OggS":
            sys.exit(f"{path}: not an Ogg page at byte {i}")
        nseg = d[i + 26]
        size = 27 + nseg + sum(d[i + 27 : i + 27 + nseg])
        d[i + 14 : i + 18] = struct.pack("<I", serial)
        d[i + 22 : i + 26] = b"\0\0\0\0"
        d[i + 22 : i + 26] = struct.pack("<I", ogg_crc(d[i : i + size]))
        i += size
    open(path, "wb").write(d)


def main():
    if shutil.which("ffmpeg") is None:
        sys.exit("ffmpeg is needed to encode the OGG files")
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    total = 0
    global rng
    for name, make in THEMES.items():
        rng = np.random.default_rng(zlib.crc32(name.encode()))   # per theme: changing one never changes the others' files
        loop, hit = make()
        loop = loopify(level(loop, 0.18, 0.8))      # quiet: it sits under the roll
        hit = fade(level(hit, 0.45, 0.95), 0.0, 0.03)  # loud: the bounce is the event
        for kind, x in (("loop", loop), ("hit", hit)):
            if not np.all(np.isfinite(x)):
                sys.exit(f"{name}-{kind}: not finite")
            wav = os.path.join(tmp, f"{name}-{kind}.wav")
            ogg = os.path.join(OUT, f"{name}-{kind}.ogg")
            write_wav(wav, x)
            encode(wav, ogg)
            size = os.path.getsize(ogg)
            total += size
            print(f"{name}-{kind}.ogg  {len(x) / SR:5.2f} s  rms {np.sqrt(np.mean(x ** 2)):.3f}  {size // 1024} KB")
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"{len(THEMES) * 2} files, {total // 1024} KB")


if __name__ == "__main__":
    main()
