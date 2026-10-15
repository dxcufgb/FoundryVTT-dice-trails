#!/usr/bin/env python3
"""
Draws the module's own particle sprite sheets (textures/*.png) for the custom trails.

Each sheet is 256x256 with 2x2 variants of 128x128, white with an alpha shape (and a little
grey shading), the same layout as the Kenney Particle Pack sheets the module already uses, so
the particle shader can tint them with any colour.

Run from the repository root:  python3 tools/make-textures.py
Needs Pillow and numpy. The output is dedicated to the public domain (CC0 1.0), see
textures/LICENSE-CC0-generated.txt.
"""

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "textures")
CELL = 128      # final cell size
SS = 4          # supersampling
S = CELL * SS   # drawing size of a cell
C = S / 2

random.seed(7)


def new_cell():
    return Image.new("RGBA", (S, S), (255, 255, 255, 0))


def finish(cell):
    """Downscale a supersampled cell to the final size."""
    return cell.resize((CELL, CELL), Image.LANCZOS)


def sheet(name, cells):
    im = Image.new("RGBA", (CELL * 2, CELL * 2), (255, 255, 255, 0))
    for i, c in enumerate(cells):
        im.paste(finish(c), ((i % 2) * CELL, (i // 2) * CELL))
    path = os.path.join(OUT, f"{name}.png")
    im.save(path, optimize=True)
    print(f"wrote {os.path.relpath(path)}")


def rot(points, angle, cx=C, cy=C):
    ca, sa = math.cos(angle), math.sin(angle)
    return [(cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca) for x, y in points]


def shade(cell, strength=0.35, direction=(-1, -1)):
    """Darken the side away from the light a little so flat shapes get some volume."""
    a = np.asarray(cell).astype(np.float32)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = ((xx - w / 2) * direction[0] + (yy - h / 2) * direction[1]) / (w / 2)
    light = 1.0 - strength * np.clip((-d + 0.2), 0, 1)
    a[..., :3] *= light[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def soften(cell, radius=1.5):
    return cell.filter(ImageFilter.GaussianBlur(radius))


def glow(cell, radius, strength=0.5):
    """Add a soft glow of the alpha shape behind the shape."""
    alpha = cell.split()[3].filter(ImageFilter.GaussianBlur(radius))
    base = Image.new("RGBA", cell.size, (255, 255, 255, 0))
    base.putalpha(alpha.point(lambda v: int(v * strength)))
    return Image.alpha_composite(base, cell)


# ----------------------------------------------------------------------------- leaves

def leaf(angle, width, bend):
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    pts = []
    n = 40
    for i in range(n + 1):
        t = i / n
        x = C - S * 0.42 + t * S * 0.84
        y = C - math.sin(t * math.pi) ** 0.9 * width * S + bend * S * (t - 0.5) ** 2
        pts.append((x, y))
    for i in range(n, -1, -1):
        t = i / n
        x = C - S * 0.42 + t * S * 0.84
        y = C + math.sin(t * math.pi) ** 1.3 * width * S * 0.8 + bend * S * (t - 0.5) ** 2
        pts.append((x, y))
    d.polygon(rot(pts, angle), fill=(255, 255, 255, 255))
    # vein
    vein = [(C - S * 0.38 + t / 20 * S * 0.76, C + bend * S * (t / 20 - 0.5) ** 2) for t in range(21)]
    d.line(rot(vein, angle), fill=(140, 140, 140, 255), width=int(S * 0.025))
    for k in range(1, 6):
        t = k / 6
        x0 = C - S * 0.38 + t * S * 0.76
        y0 = C + bend * S * (t - 0.5) ** 2
        for side in (-1, 1):
            d.line(rot([(x0, y0), (x0 + S * 0.08, y0 + side * width * S * 0.6 * math.sin(t * math.pi))], angle),
                   fill=(170, 170, 170, 255), width=int(S * 0.015))
    return shade(soften(cell, 1.2), 0.25)


def leaves():
    return [leaf(0.4, 0.22, 0.0), leaf(-0.9, 0.18, 0.15), leaf(1.8, 0.26, -0.1), leaf(2.6, 0.2, 0.08)]


# ----------------------------------------------------------------------------- petals

def petal(angle, width, notch):
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    pts = []
    n = 48
    for i in range(n + 1):
        t = i / n
        a = -math.pi / 2 + t * math.pi
        r = S * 0.42 * (0.55 + 0.45 * math.cos(a) ** 0.5 if math.cos(a) > 0 else 0.3)
        x = C + math.cos(a) * r * 1.0
        y = C + math.sin(a) * r * width * 2.2
        pts.append((x, y))
    # a notch at the tip
    tip = [(C + S * 0.42, C - notch * S), (C + S * 0.36, C), (C + S * 0.42, C + notch * S)]
    left = [(C - S * 0.3, C)]
    d.polygon(rot(pts + [tip[2], tip[1], tip[0]] + left, angle), fill=(255, 255, 255, 255))
    # faint inner shading toward the base
    inner = new_cell()
    di = ImageDraw.Draw(inner)
    di.ellipse([C - S * 0.3, C - S * 0.12, C - S * 0.05, C + S * 0.12], fill=(180, 180, 180, 255))
    inner = inner.filter(ImageFilter.GaussianBlur(S * 0.06))
    cell = Image.composite(inner, cell, inner.split()[3].point(lambda v: int(v * 0.6)))
    return shade(soften(cell, 1.5), 0.2)


def petals():
    return [petal(0.2, 0.26, 0.05), petal(-1.1, 0.3, 0.07), petal(1.6, 0.22, 0.04), petal(2.9, 0.28, 0.06)]


# ----------------------------------------------------------------------------- snowflakes

def snowflake(arms, branch, angle):
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    w = int(S * 0.035)
    for k in range(arms):
        a = angle + k * 2 * math.pi / arms
        ex, ey = C + math.cos(a) * S * 0.44, C + math.sin(a) * S * 0.44
        d.line([(C, C), (ex, ey)], fill=(255, 255, 255, 255), width=w)
        for t, ln in branch:
            bx, by = C + math.cos(a) * S * 0.44 * t, C + math.sin(a) * S * 0.44 * t
            for side in (-1, 1):
                b = a + side * math.pi / 3
                d.line([(bx, by), (bx + math.cos(b) * S * ln, by + math.sin(b) * S * ln)],
                       fill=(255, 255, 255, 255), width=int(w * 0.8))
        d.ellipse([ex - w, ey - w, ex + w, ey + w], fill=(255, 255, 255, 255))
    d.ellipse([C - w * 1.5, C - w * 1.5, C + w * 1.5, C + w * 1.5], fill=(255, 255, 255, 255))
    return glow(soften(cell, 1.0), S * 0.03, 0.35)


def snowflakes():
    return [snowflake(6, [(0.45, 0.12), (0.75, 0.08)], 0),
            snowflake(6, [(0.35, 0.1), (0.6, 0.1), (0.85, 0.05)], 0.3),
            snowflake(6, [(0.55, 0.16)], 0.6),
            snowflake(8, [(0.5, 0.09), (0.8, 0.06)], 0.2)]


# ----------------------------------------------------------------------------- music notes

def note(kind):
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    w = int(S * 0.045)
    head = (S * 0.13, S * 0.095)

    def draw_head(x, y):
        pts = [(x + head[0] * math.cos(a) * math.cos(-0.4) - head[1] * math.sin(a) * math.sin(-0.4),
                y + head[0] * math.cos(a) * math.sin(-0.4) + head[1] * math.sin(a) * math.cos(-0.4))
               for a in np.linspace(0, 2 * math.pi, 48)]
        d.polygon(pts, fill=(255, 255, 255, 255))

    if kind == "quaver":
        x, y = C - S * 0.08, C + S * 0.25
        draw_head(x, y)
        d.line([(x + head[0] * 0.85, y - S * 0.02), (x + head[0] * 0.85, y - S * 0.52)], fill=(255, 255, 255, 255), width=w)
        # flag
        fx = x + head[0] * 0.85
        d.line([(fx, y - S * 0.52), (fx + S * 0.16, y - S * 0.38), (fx + S * 0.18, y - S * 0.2)], fill=(255, 255, 255, 255), width=w, joint="curve")
    elif kind == "crotchet":
        x, y = C, C + S * 0.22
        draw_head(x, y)
        d.line([(x + head[0] * 0.85, y - S * 0.02), (x + head[0] * 0.85, y - S * 0.5)], fill=(255, 255, 255, 255), width=w)
    elif kind == "beamed":
        x1, y1 = C - S * 0.2, C + S * 0.24
        x2, y2 = C + S * 0.16, C + S * 0.18
        draw_head(x1, y1)
        draw_head(x2, y2)
        top1, top2 = y1 - S * 0.5, y2 - S * 0.5
        d.line([(x1 + head[0] * 0.85, y1 - S * 0.02), (x1 + head[0] * 0.85, top1)], fill=(255, 255, 255, 255), width=w)
        d.line([(x2 + head[0] * 0.85, y2 - S * 0.02), (x2 + head[0] * 0.85, top2)], fill=(255, 255, 255, 255), width=w)
        d.line([(x1 + head[0] * 0.85, top1), (x2 + head[0] * 0.85, top2)], fill=(255, 255, 255, 255), width=int(w * 1.8))
    elif kind == "double":
        x1, y1 = C - S * 0.2, C + S * 0.2
        x2, y2 = C + S * 0.16, C + S * 0.26
        draw_head(x1, y1)
        draw_head(x2, y2)
        top = C - S * 0.3
        d.line([(x1 + head[0] * 0.85, y1 - S * 0.02), (x1 + head[0] * 0.85, top)], fill=(255, 255, 255, 255), width=w)
        d.line([(x2 + head[0] * 0.85, y2 - S * 0.02), (x2 + head[0] * 0.85, top)], fill=(255, 255, 255, 255), width=w)
        d.line([(x1 + head[0] * 0.85, top), (x2 + head[0] * 0.85, top)], fill=(255, 255, 255, 255), width=int(w * 1.8))
        d.line([(x1 + head[0] * 0.85, top + S * 0.08), (x2 + head[0] * 0.85, top + S * 0.08)], fill=(255, 255, 255, 255), width=int(w * 1.8))
    return glow(soften(cell, 1.0), S * 0.04, 0.3)


def notes():
    return [note("quaver"), note("beamed"), note("crotchet"), note("double")]


# ----------------------------------------------------------------------------- glyphs

def glyph(kind):
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    w = int(S * 0.03)
    r = S * 0.4
    col = (255, 255, 255, 255)
    d.ellipse([C - r, C - r, C + r, C + r], outline=col, width=w)
    if kind == 0:      # triangle in a circle with a dot
        pts = [(C + r * 0.82 * math.cos(a), C + r * 0.82 * math.sin(a)) for a in (-math.pi / 2, math.pi / 6, 5 * math.pi / 6)]
        d.polygon(pts, outline=col, width=w)
        d.ellipse([C - w * 1.5, C - w * 1.5, C + w * 1.5, C + w * 1.5], fill=col)
    elif kind == 1:    # pentagram
        pts = [(C + r * 0.82 * math.cos(-math.pi / 2 + k * 4 * math.pi / 5), C + r * 0.82 * math.sin(-math.pi / 2 + k * 4 * math.pi / 5)) for k in range(5)]
        d.line(pts + [pts[0]], fill=col, width=w)
    elif kind == 2:    # inner ring, crossed lines
        d.ellipse([C - r * 0.55, C - r * 0.55, C + r * 0.55, C + r * 0.55], outline=col, width=w)
        for a in (0, math.pi / 2, math.pi / 4, -math.pi / 4):
            d.line([(C + math.cos(a) * r * 0.55, C + math.sin(a) * r * 0.55), (C + math.cos(a) * r, C + math.sin(a) * r)], fill=col, width=w)
    else:              # square in a circle, small ticks
        pts = [(C + r * 0.78 * math.cos(a), C + r * 0.78 * math.sin(a)) for a in (math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4)]
        d.polygon(pts, outline=col, width=w)
        for k in range(12):
            a = k * math.pi / 6
            d.line([(C + math.cos(a) * r * 0.9, C + math.sin(a) * r * 0.9), (C + math.cos(a) * r, C + math.sin(a) * r)], fill=col, width=int(w * 0.8))
    return glow(soften(cell, 1.0), S * 0.03, 0.4)


def glyphs():
    return [glyph(k) for k in range(4)]


# ----------------------------------------------------------------------------- knives

def knife(angle, blade_w, length):
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    L = S * length
    # blade: pointed, with a brighter edge and a darker flat
    tip = (C + L * 0.5, C)
    guard_x = C - L * 0.12
    blade = [tip, (guard_x, C - S * blade_w), (guard_x, C + S * blade_w)]
    d.polygon(rot(blade, angle), fill=(235, 235, 235, 255))
    d.polygon(rot([tip, (guard_x, C), (guard_x, C + S * blade_w)], angle), fill=(170, 170, 170, 255))
    # guard
    g = [(guard_x - S * 0.02, C - S * blade_w * 1.9), (guard_x + S * 0.02, C - S * blade_w * 1.9),
         (guard_x + S * 0.02, C + S * blade_w * 1.9), (guard_x - S * 0.02, C + S * blade_w * 1.9)]
    d.polygon(rot(g, angle), fill=(200, 200, 200, 255))
    # hilt and pommel
    h = [(guard_x - S * 0.02, C - S * blade_w * 0.9), (C - L * 0.48, C - S * blade_w * 0.9),
         (C - L * 0.48, C + S * blade_w * 0.9), (guard_x - S * 0.02, C + S * blade_w * 0.9)]
    d.polygon(rot(h, angle), fill=(120, 120, 120, 255))
    px, py = C - L * 0.5, C
    pr = S * blade_w * 1.2
    d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(190, 190, 190, 255))
    cell = cell.rotate(0)
    return shade(soften(cell, 1.2), 0.2, (0, -1))


def knives():
    return [knife(0.0, 0.055, 0.86), knife(1.2, 0.07, 0.8), knife(-0.7, 0.05, 0.9), knife(2.4, 0.065, 0.78)]


# ----------------------------------------------------------------------------- stones

def stone(seed):
    rnd = random.Random(seed)
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    n = rnd.randint(6, 9)
    pts = []
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.uniform(-0.25, 0.25)
        r = S * rnd.uniform(0.28, 0.42)
        pts.append((C + math.cos(a) * r, C + math.sin(a) * r * rnd.uniform(0.75, 1.0)))
    d.polygon(pts, fill=(225, 225, 225, 255))
    # facets: a few darker triangles from the centre
    for k in range(n):
        p1, p2 = pts[k], pts[(k + 1) % n]
        v = rnd.choice([150, 175, 200, 215])
        d.polygon([(C + rnd.uniform(-S * 0.06, S * 0.06), C + rnd.uniform(-S * 0.06, S * 0.06)), p1, p2], fill=(v, v, v, 255))
    return shade(soften(cell, 1.0), 0.3)


def stones():
    return [stone(k) for k in range(4)]


# ----------------------------------------------------------------------------- flares

def flare(kind):
    """A bright streak of light with a soft core: lens-flare like."""
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    x = (xx - C) / C
    y = (yy - C) / C
    core = np.exp(-(x * x + y * y) * 10.0)
    if kind == 0:
        streak = np.exp(-(y * y) * 160.0) * np.exp(-abs(x) * 2.2)
        cross = np.exp(-(x * x) * 160.0) * np.exp(-abs(y) * 4.0) * 0.6
    elif kind == 1:
        streak = np.exp(-(y * y) * 60.0) * np.exp(-abs(x) * 3.0)
        cross = 0
    elif kind == 2:
        xr, yr = (x + y) / math.sqrt(2), (x - y) / math.sqrt(2)
        streak = np.exp(-(yr * yr) * 160.0) * np.exp(-abs(xr) * 2.5) + np.exp(-(xr * xr) * 160.0) * np.exp(-abs(yr) * 2.5)
        cross = 0
    else:
        streak = np.exp(-(y * y) * 240.0) * np.exp(-abs(x) * 1.6)
        cross = np.exp(-(x * x) * 240.0) * np.exp(-abs(y) * 1.6)
    a = np.clip(core + streak + cross, 0, 1)
    rgba = np.zeros((S, S, 4), np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(rgba)


def flares():
    return [flare(k) for k in range(4)]


# ----------------------------------------------------------------------------- bubbles and drops

def bubble(r, hx, hy):
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    x = (xx - C) / (S * r)
    y = (yy - C) / (S * r)
    d = np.sqrt(x * x + y * y)
    rim = np.clip(1 - abs(d - 0.93) / 0.07, 0, 1) ** 1.5
    body = np.clip(1 - d, 0, 1) * 0.22
    hl = np.exp(-((x - hx) ** 2 + (y - hy) ** 2) * 40.0)
    a = np.where(d <= 1.0, np.clip(rim * 0.95 + body + hl, 0, 1), 0)
    rgba = np.zeros((S, S, 4), np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(rgba)


def bubbles():
    return [bubble(0.42, -0.35, -0.35), bubble(0.36, 0.3, -0.4), bubble(0.3, -0.3, -0.3), bubble(0.44, -0.4, 0.2)]


def drop(angle, fat):
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    pts = []
    for i in range(80):
        t = i / 80 * 2 * math.pi
        # teardrop: pointed at the top, round at the bottom
        x = C + math.sin(t) * (math.sin(t / 2) ** 1.6) * S * 0.3 * fat
        y = C - math.cos(t) * S * 0.36
        pts.append((x, y))
    d.polygon(rot(pts, angle), fill=(235, 235, 235, 255))
    # highlight
    hx, hy = rot([(C - S * 0.09, C + S * 0.08)], angle)[0]
    d.ellipse([hx - S * 0.045, hy - S * 0.08, hx + S * 0.045, hy + S * 0.08], fill=(255, 255, 255, 255))
    return shade(soften(cell, 1.5), 0.3, (1, 1))


def drops():
    return [drop(0, 1.0), drop(0.5, 0.85), drop(-0.4, 1.1), drop(2.5, 0.9)]


# ----------------------------------------------------------------------------- skulls

def skull(angle, jaw):
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    white = (240, 240, 240, 255)
    # cranium
    d.ellipse([C - S * 0.34, C - S * 0.38, C + S * 0.34, C + S * 0.22], fill=white)
    # jaw
    d.rounded_rectangle([C - S * 0.2, C + S * 0.05, C + S * 0.2, C + S * 0.05 + S * jaw], radius=int(S * 0.06), fill=white)
    # eye sockets and nose cut out (alpha 0)
    hole = (0, 0, 0, 0)
    for sx in (-1, 1):
        d.ellipse([C + sx * S * 0.15 - S * 0.1, C - S * 0.16, C + sx * S * 0.15 + S * 0.1, C + S * 0.02], fill=hole)
    d.polygon([(C, C - S * 0.02), (C - S * 0.05, C + S * 0.1), (C + S * 0.05, C + S * 0.1)], fill=hole)
    # teeth lines
    for k in range(-2, 3):
        x = C + k * S * 0.08
        d.line([(x, C + S * 0.14), (x, C + S * 0.05 + S * jaw)], fill=(150, 150, 150, 255), width=int(S * 0.015))
    if angle:
        cell = cell.rotate(math.degrees(angle), resample=Image.BICUBIC, center=(C, C))
    return shade(soften(cell, 1.2), 0.3)


def skulls():
    return [skull(0, 0.24), skull(0.25, 0.2), skull(-0.3, 0.26), skull(0.1, 0.22)]


# ----------------------------------------------------------------------------- coins

def coin(tilt, angle, face):
    """A coin seen at a tilt (1: face on, small: nearly edge on), with a raised rim and a mark."""
    cell = new_cell()
    d = ImageDraw.Draw(cell)
    rx, ry = S * 0.36, S * 0.36 * tilt
    edge = S * 0.05 * (1 - tilt) + S * 0.012
    # the edge (thickness) shows under the face when the coin is tilted
    d.ellipse([C - rx, C - ry + edge, C + rx, C + ry + edge], fill=(150, 150, 150, 255))
    d.ellipse([C - rx, C - ry, C + rx, C + ry], fill=(235, 235, 235, 255))
    # raised rim
    k = 0.8
    d.ellipse([C - rx * k, C - ry * k, C + rx * k, C + ry * k], outline=(175, 175, 175, 255), width=int(S * 0.025))
    # the mark: a star on one face, a crown-like bar on the other
    if face == 0:
        pts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            r = (0.42 if i % 2 == 0 else 0.18) * rx
            pts.append((C + math.cos(a) * r, C + math.sin(a) * r * tilt))
        d.polygon(pts, fill=(190, 190, 190, 255))
    else:
        d.rectangle([C - rx * 0.32, C - ry * 0.1, C + rx * 0.32, C + ry * 0.12], fill=(190, 190, 190, 255))
        for sx in (-0.28, 0, 0.28):
            d.polygon([(C + rx * (sx - 0.08), C - ry * 0.1), (C + rx * sx, C - ry * 0.38), (C + rx * (sx + 0.08), C - ry * 0.1)], fill=(190, 190, 190, 255))
    # a glint on the rim
    d.arc([C - rx * 0.95, C - ry * 0.95, C + rx * 0.95, C + ry * 0.95], 200, 260, fill=(255, 255, 255, 255), width=int(S * 0.03))
    if angle:
        cell = cell.rotate(math.degrees(angle), resample=Image.BICUBIC, center=(C, C))
    return shade(soften(cell, 1.0), 0.25)


def coins():
    return [coin(1.0, 0, 0), coin(0.55, 0.4, 1), coin(0.25, -0.3, 0), coin(0.8, 2.2, 1)]


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [("leaves", leaves), ("petals", petals), ("snowflakes", snowflakes), ("notes", notes),
                     ("glyphs", glyphs), ("knives", knives), ("stones", stones), ("flares", flares),
                     ("bubbles", bubbles), ("drops", drops), ("skulls", skulls), ("coins", coins)]:
        sheet(name, fn())
