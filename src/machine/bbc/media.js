const UEF_SIGNATURE = "UEF File!\0";
const SSD_SECTOR_SIZE = 256;
const SSD_SECTORS_PER_TRACK = 10;

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

export class SsdDisk {
  constructor(bytes) {
    const source = Uint8Array.from(bytes);
    if (source.length === 0 || source.length % (SSD_SECTOR_SIZE * SSD_SECTORS_PER_TRACK) !== 0) throw new Error("SSD image must contain ten 256-byte sectors per track");
    this.bytes = source.slice();
    this.tracks = source.length / (SSD_SECTOR_SIZE * SSD_SECTORS_PER_TRACK);
    this.dirty = false;
  }

  readSector(track, sector) { return this.bytes.slice(this.#offset(track, sector), this.#offset(track, sector) + SSD_SECTOR_SIZE); }
  writeSector(track, sector, data) {
    const source = Uint8Array.from(data);
    if (source.length !== SSD_SECTOR_SIZE) throw new Error("SSD sectors are 256 bytes");
    this.bytes.set(source, this.#offset(track, sector)); this.dirty = true;
  }
  export() { return this.bytes.slice(); }
  #offset(track, sector) {
    if (!Number.isInteger(track) || track < 0 || track >= this.tracks || !Number.isInteger(sector) || sector < 0 || sector >= SSD_SECTORS_PER_TRACK) throw new RangeError("SSD track or sector is out of range");
    return (track * SSD_SECTORS_PER_TRACK + sector) * SSD_SECTOR_SIZE;
  }
}

export const SSD_GEOMETRY = Object.freeze({ sectorSize: SSD_SECTOR_SIZE, sectorsPerTrack: SSD_SECTORS_PER_TRACK });
