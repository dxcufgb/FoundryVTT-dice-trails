/**
 * Optional integration with Dxcufgb's Debug Recorder (module id "dxcufgbs-debug-recorder"), a GM-run recorder
 * that collects debugging data from the dxcufgb modules into a file for bug reports. Not a dependency: without
 * the recorder (or while it is not recording) everything here does nothing, and a recorder error never reaches
 * the dice trails.
 *
 *   registerDebugRecorder(snapshot)  give the recorder a function that describes this module's runtime state
 *   crumb(key, data)                 leave a breadcrumb ("area.action", a small flat object) while it records
 *   noteError(code)                  count a caught error by a fixed code (shown in the snapshot, and a crumb)
 *
 * Registration happens once, whichever comes first: the recorder's "dxcufgbs-debug-recorder.ready" hook, or its
 * API already being there on this module's init / ready. Snapshot and breadcrumb data must never contain names,
 * free text, image paths or URLs: only counts, booleans, version strings and the module's own fixed ids.
 */

import { MODULE_ID } from "./constants.js";

const RECORDER_ID = "dxcufgbs-debug-recorder";

let recorder = null;       // the recorder's API, once known
let snapshotFn = null;     // this module's snapshot provider
let registered = false;
const errors = { counts: {}, last: null, lastAt: null };

/** The recorder's API if it is installed and ready, else null. */
function api() {
  if (!recorder) {
    try {
      recorder = game.modules?.get(RECORDER_ID)?.api ?? null;
    } catch (_) {
      recorder = null;
    }
  }
  return recorder;
}

/** The snapshot plus the error counts; a failing snapshot reports that instead of throwing into the recorder. */
function safeSnapshot() {
  try {
    return { ...snapshotFn(), errors: { counts: { ...errors.counts }, last: errors.last, lastAt: errors.lastAt } };
  } catch (err) {
    console.warn(`${MODULE_ID} | debug recorder snapshot failed`, err);
    return { snapshotFailed: true };
  }
}

/** Register with the recorder if it is there and this module has not registered yet. */
function tryRegister() {
  if (registered || !snapshotFn) return;
  const rec = api();
  if (typeof rec?.register !== "function") return;
  registered = true;
  try {
    rec.register(MODULE_ID, { snapshot: safeSnapshot });
  } catch (err) {
    console.warn(`${MODULE_ID} | could not register with the debug recorder`, err);
  }
}

/** Give the recorder this module's snapshot provider (registered once, as soon as the recorder is there). */
export function registerDebugRecorder(snapshot) {
  if (typeof snapshot === "function") snapshotFn = snapshot;
  tryRegister();
}

/** A breadcrumb for the recorder while it records; otherwise nothing. Never throws. */
export function crumb(key, data) {
  try {
    const rec = api();
    if (!rec || !rec.isRecording?.()) return;
    rec.breadcrumb(MODULE_ID, key, data);
  } catch (_) { /* the recorder must never break the trails */ }
}

/** Count a caught error by a fixed code (no messages: they can hold paths or names). */
export function noteError(code) {
  try {
    errors.counts[code] = (errors.counts[code] ?? 0) + 1;
    errors.last = code;
    errors.lastAt = Date.now();
  } catch (_) { /* never throws */ }
  crumb("error.caught", { code });
}

Hooks.once("dxcufgbs-debug-recorder.ready", rec => {
  if (rec) recorder = rec;
  tryRegister();
});
// Load order must not matter: the recorder may have been ready before this module's hooks ran.
for (const hook of ["init", "ready"]) Hooks.once(hook, tryRegister);
