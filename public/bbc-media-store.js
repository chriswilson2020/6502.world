const DATABASE_NAME = "6502-world-bbc-media";
const STORE_NAME = "media";

export class IndexedDbBbcMediaStore {
  constructor({ indexedDB = globalThis.indexedDB, databaseName = DATABASE_NAME } = {}) { this.indexedDB = indexedDB; this.databaseName = databaseName; this.databasePromise = null; }
  async put(record) { const normalized = normalizeMediaRecord(record); await this.#request("readwrite", (store) => store.put(normalized)); return cloneRecord(normalized); }
  async get(id) { const record = await this.#request("readonly", (store) => store.get(id)); return record ? normalizeMediaRecord(record) : null; }
  async list() { const records = await this.#request("readonly", (store) => store.getAll()); return records.map(normalizeMediaRecord); }
  async delete(id) { await this.#request("readwrite", (store) => store.delete(id)); }
  async clear() { await this.#request("readwrite", (store) => store.clear()); }
  async #open() {
    if (!this.indexedDB) throw new Error("IndexedDB is unavailable in this browser.");
    if (!this.databasePromise) this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" }); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error("Unable to open BBC media storage."));
    });
    return this.databasePromise;
  }
  async #request(mode, operation) {
    const database = await this.#open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode); const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error("BBC media storage request failed.")); transaction.onabort = () => reject(transaction.error ?? new Error("BBC media storage transaction aborted."));
    });
  }
}

export class MemoryBbcMediaStore {
  constructor() { this.records = new Map(); }
  async put(record) { const normalized = normalizeMediaRecord(record); this.records.set(normalized.id, cloneRecord(normalized)); return cloneRecord(normalized); }
  async get(id) { const record = this.records.get(id); return record ? cloneRecord(record) : null; }
  async list() { return [...this.records.values()].map(cloneRecord); }
  async delete(id) { this.records.delete(id); }
  async clear() { this.records.clear(); }
}

export function normalizeMediaRecord(record) {
  if (!record || typeof record !== "object") throw new TypeError("BBC media record must be an object");
  if (typeof record.id !== "string" || !record.id) throw new TypeError("BBC media record requires an id");
  if (typeof record.name !== "string" || !record.name) throw new TypeError("BBC media record requires a name");
  if (!/^(ssd|dsd)$/.test(record.format)) throw new TypeError("BBC media record format must be ssd or dsd");
  if (!/^[a-f0-9]{64}$/i.test(record.baseImageSha256 ?? "")) throw new TypeError("BBC media record requires a SHA-256 base hash");
  const bytes = toBytes(record.bytes); const baseBytes = record.baseBytes == null ? null : toBytes(record.baseBytes);
  const geometry = { tracks: Number(record.geometry?.tracks), sides: Number(record.geometry?.sides), sectorsPerTrack: Number(record.geometry?.sectorsPerTrack), sectorSize: Number(record.geometry?.sectorSize) };
  if (!Object.values(geometry).every(Number.isInteger)) throw new TypeError("BBC media record requires integer geometry");
  return { id: record.id, name: record.name, baseImageSha256: record.baseImageSha256.toLowerCase(), format: record.format, geometry, bytes, baseBytes, dirty: Boolean(record.dirty), revision: Number(record.revision) || 0, lastModified: record.lastModified ?? new Date().toISOString(), catalogueAssociation: record.catalogueAssociation ?? null, writeProtected: Boolean(record.writeProtected) };
}

function toBytes(value) { if (value instanceof Uint8Array) return value.slice(); if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0)); if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)); if (Array.isArray(value)) return Uint8Array.from(value); throw new TypeError("BBC media record requires image bytes"); }
function cloneRecord(record) { return { ...record, geometry: { ...record.geometry }, bytes: record.bytes.slice(), baseBytes: record.baseBytes?.slice() ?? null }; }
