import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeWav, renderAmbient, renderSfx, SAMPLE_RATE } from "../synth";

test("WAV header is valid PCM", () => {
  const wav = encodeWav(new Float32Array([0, 1, -1]), new Float32Array([0, 0.5, -0.5]));
  const v = new DataView(wav.buffer);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint32(24, true), SAMPLE_RATE);
  assert.equal(v.getUint32(40, true), 3 * 2 * 2);
  assert.equal(v.getInt16(44 + 4, true), 0x7fff);
  assert.equal(v.getInt16(44 + 8, true), -0x8000);
});

test("ambient loops are seamless and never clip", () => {
  for (const id of ["white-noise", "rain", "hearth", "waves"] as const) {
    const [l, r] = renderAmbient(id, 2);
    assert.equal(l.length, r.length);
    let peak = 0;
    for (const s of l) peak = Math.max(peak, Math.abs(s));
    assert.ok(peak <= 1, `${id} clips`);
    // Seam: the jump from last to first sample stays within normal step size.
    const step = Math.abs(l[0] - l[l.length - 1]);
    assert.ok(step < 0.6, `${id} seam jump ${step}`);
  }
});

test("binaural loop holds whole cycles (no seam click)", () => {
  const [l] = renderAmbient("waves");
  assert.ok(Math.abs(l[0] - l[l.length - 1]) < 0.06);
});

test("sfx are short and deterministic", () => {
  const a = renderSfx("latch");
  const b = renderSfx("latch");
  assert.ok(a.length < SAMPLE_RATE);
  assert.deepEqual(a.slice(0, 64), b.slice(0, 64));
});
