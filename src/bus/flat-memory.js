/**
 * A deterministic 64K byte-addressable bus used by the CPU Lab and tests.
 * Machine implementations can replace this with memory-mapped buses while
 * keeping the CPU API unchanged.
 */
export class FlatMemory {
  constructor(size = 0x10000) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new TypeError("size must be a positive integer");
    }

    this.bytes = new Uint8Array(size);
  }

  read8(address) {
    return this.bytes[this.#normalize(address)];
  }

  write8(address, value) {
    this.bytes[this.#normalize(address)] = value & 0xff;
  }

  read16(address) {
    const low = this.read8(address);
    const high = this.read8(address + 1);
    return low | (high << 8);
  }

  write16(address, value) {
    this.write8(address, value);
    this.write8(address + 1, value >> 8);
  }

  load(data, start = 0) {
    if (!(data instanceof Uint8Array) && !Array.isArray(data)) {
      throw new TypeError("data must be a Uint8Array or array of bytes");
    }

    for (let index = 0; index < data.length; index += 1) {
      this.write8(start + index, data[index]);
    }
  }

  clear(value = 0) {
    this.bytes.fill(value & 0xff);
  }

  snapshot() {
    return new Uint8Array(this.bytes);
  }

  restore(snapshot) {
    if (!(snapshot instanceof Uint8Array) || snapshot.length !== this.bytes.length) {
      throw new TypeError("snapshot must match the memory size");
    }
    this.bytes.set(snapshot);
  }

  #normalize(address) {
    if (!Number.isFinite(address)) {
      throw new TypeError("address must be numeric");
    }
    return (address >>> 0) % this.bytes.length;
  }
}
