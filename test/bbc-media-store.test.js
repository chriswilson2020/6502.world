import assert from "node:assert/strict";
import test from "node:test";
import { MemoryBbcMediaStore, normalizeMediaRecord } from "../public/bbc-media-store.js";

const record = () => ({ id: "drive-0", name: "working.dsd", baseImageSha256: "a".repeat(64), format: "dsd", geometry: { tracks: 80, sides: 2, sectorsPerTrack: 10, sectorSize: 256 }, bytes: new Uint8Array(409600), baseBytes: new Uint8Array(409600), dirty: true, revision: 3, lastModified: "2026-08-03T00:00:00.000Z", catalogueAssociation: "acorn-cpm-utilities", writeProtected: false });

test("BBC media persistence records clone full images and metadata", async () => {
  const store = new MemoryBbcMediaStore(); const source = record(); await store.put(source); source.bytes[0] = 9;
  const restored = await store.get("drive-0"); assert.equal(restored.bytes[0], 0); assert.equal(restored.geometry.sides, 2); assert.equal(restored.revision, 3);
  restored.bytes[0] = 7; assert.equal((await store.get("drive-0")).bytes[0], 0); assert.equal((await store.list()).length, 1); await store.delete("drive-0"); assert.equal(await store.get("drive-0"), null);
});

test("BBC media persistence rejects incomplete records", () => { assert.throws(() => normalizeMediaRecord({ ...record(), baseImageSha256: "bad" }), /SHA-256/); assert.throws(() => normalizeMediaRecord({ ...record(), bytes: null }), /image bytes/); });
