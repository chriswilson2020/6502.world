const UEF_SIGNATURE = "UEF File!\0";
const SECTOR_SIZE = 256;
const SECTORS_PER_TRACK = 10;
const MAX_TRACKS = 80;

export class UefCassette {
  constructor(bytes) {
    const source = Uint8Array.from(bytes);
    if (source.length < 12 || new TextDecoder("latin1").decode(source.subarray(0, 10)) !== UEF_SIGNATURE) throw new Error("invalid UEF signature");
    this.version = `${source[11]}.${source[10]}`;
    this.source = source.slice();
    this.chunks = [];
    const stream = [];
    for (let offset = 12; offset < source.length;) {
      if (offset + 6 > source.length) throw new Error("truncated UEF chunk header");
      const id = source[offset] | (source[offset + 1] << 8);
      const length = source[offset + 2] | (source[offset + 3] << 8) | (source[offset + 4] << 16) | (source[offset + 5] << 24);
      offset += 6;
      if (length < 0 || offset + length > source.length) throw new Error("truncated UEF chunk body");
      const data = source.slice(offset, offset + length);
      this.chunks.push({ id, data });
      if (id === 0x0100) stream.push(...data);
      offset += length;
    }
    this.data = Uint8Array.from(stream);
    this.position = 0;
    this.playing = false;
  }

  play() { this.playing = true; }
  pause() { this.playing = false; }
  rewind() { this.position = 0; }
  readByte() { if (!this.playing || this.position >= this.data.length) return null; return this.data[this.position++]; }
}

export class SectorDisk {
  constructor(bytes, { format, sides }) {
    const source = Uint8Array.from(bytes);
    const bytesPerTrack = SECTOR_SIZE * SECTORS_PER_TRACK * sides;
    if (source.length === 0 || source.length % bytesPerTrack !== 0) throw new Error(`${format.toUpperCase()} image has invalid geometry`);
    const tracks = source.length / bytesPerTrack;
    if (!Number.isInteger(tracks) || tracks < 1 || tracks > MAX_TRACKS) throw new Error(`${format.toUpperCase()} image must contain 1-${MAX_TRACKS} complete tracks`);
    this.bytes = source.slice();
    this.format = format; this.tracks = tracks; this.sides = sides; this.sectorsPerTrack = SECTORS_PER_TRACK; this.sectorSize = SECTOR_SIZE;
    this.geometry = Object.freeze({ format, tracks, sides, sectorsPerTrack: SECTORS_PER_TRACK, sectorSize: SECTOR_SIZE });
    this.dirty = false; this.revision = 0;
  }

  readSector(track, sideOrSector, maybeSector) {
    const [side, sector] = normalizeSectorArguments(sideOrSector, maybeSector);
    const offset = this.#offset(track, side, sector); return this.bytes.slice(offset, offset + SECTOR_SIZE);
  }
  writeSector(track, sideOrSector, sectorOrData, maybeData) {
    const legacy = maybeData === undefined; const side = legacy ? 0 : sideOrSector; const sector = legacy ? sideOrSector : sectorOrData; const data = legacy ? sectorOrData : maybeData;
    const source = Uint8Array.from(data);
    if (source.length !== SECTOR_SIZE) throw new Error(`${this.format.toUpperCase()} sectors are ${SECTOR_SIZE} bytes`);
    this.bytes.set(source, this.#offset(track, side, sector)); this.dirty = true; this.revision += 1;
  }
  export() { return this.bytes.slice(); }
  #offset(track, side, sector) {
    if (!Number.isInteger(track) || track < 0 || track >= this.tracks || !Number.isInteger(side) || side < 0 || side >= this.sides || !Number.isInteger(sector) || sector < 0 || sector >= SECTORS_PER_TRACK) throw new RangeError(`${this.format.toUpperCase()} track, side or sector is out of range`);
    return (((track * this.sides) + side) * SECTORS_PER_TRACK + sector) * SECTOR_SIZE;
  }
}

export class SsdDisk extends SectorDisk { constructor(bytes) { super(bytes, { format: "ssd", sides: 1 }); } }
export class DsdDisk extends SectorDisk { constructor(bytes) { super(bytes, { format: "dsd", sides: 2 }); } }

export function createSectorDisk(bytes, { format, filename } = {}) {
  const extension = filename?.split(".").pop()?.toLowerCase(); const selected = format?.toLowerCase() ?? (extension === "ssd" || extension === "dsd" ? extension : null);
  if (selected === "ssd") return new SsdDisk(bytes);
  if (selected === "dsd") return new DsdDisk(bytes);
  if (selected) throw new Error(`unsupported sector image format: ${selected}`);
  if (bytes.length === MAX_TRACKS * SECTORS_PER_TRACK * SECTOR_SIZE) return new SsdDisk(bytes);
  if (bytes.length === MAX_TRACKS * 2 * SECTORS_PER_TRACK * SECTOR_SIZE) return new DsdDisk(bytes);
  throw new Error("sector image format is ambiguous; specify SSD or DSD");
}

export function serializeSectorDisk(disk) { return { format: disk.format, bytes: disk.export(), dirty: disk.dirty, revision: disk.revision }; }
export function restoreSectorDisk(state) { const disk = createSectorDisk(state.bytes, { format: state.format }); disk.dirty = Boolean(state.dirty); disk.revision = state.revision ?? (disk.dirty ? 1 : 0); return disk; }

function normalizeSectorArguments(sideOrSector, maybeSector) { return maybeSector === undefined ? [0, sideOrSector] : [sideOrSector, maybeSector]; }

export const SSD_GEOMETRY = Object.freeze({ sectorSize: SECTOR_SIZE, sectorsPerTrack: SECTORS_PER_TRACK });
export const DSD_GEOMETRY = Object.freeze({ sectorSize: SECTOR_SIZE, sectorsPerTrack: SECTORS_PER_TRACK, sides: 2, tracks: MAX_TRACKS, bytes: MAX_TRACKS * 2 * SECTORS_PER_TRACK * SECTOR_SIZE });
