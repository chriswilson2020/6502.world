export class AtomKeyboardMatrix {
  constructor() { this.reset(); }

  reset() {
    this.columns = new Uint8Array(10).fill(0x3f);
    this.control = false;
    this.shift = false;
    this.repeat = false;
  }

  press(column, row) { this.#set(column, row, true); }
  release(column, row) { this.#set(column, row, false); }
  setControl(pressed) { this.control = Boolean(pressed); }
  setShift(pressed) { this.shift = Boolean(pressed); }
  setRepeat(pressed) { this.repeat = Boolean(pressed); }

  readColumn(column) {
    let value = column >= 0 && column < this.columns.length ? this.columns[column] : 0x3f;
    if (!this.control) value |= 0x40;
    if (!this.shift) value |= 0x80;
    return value;
  }

  #set(column, row, pressed) {
    if (!Number.isInteger(column) || column < 0 || column > 9) throw new RangeError("Atom keyboard column must be 0-9");
    if (!Number.isInteger(row) || row < 0 || row > 5) throw new RangeError("Atom keyboard row must be 0-5");
    const mask = 1 << row;
    if (pressed) this.columns[column] &= ~mask;
    else this.columns[column] |= mask;
  }
}

export class AtomPpi8255 {
  constructor({ keyboard = new AtomKeyboardMatrix() } = {}) {
    this.name = "8255 PPI";
    this.keyboard = keyboard;
    this.reset();
  }

  reset() {
    this.portA = 0;
    this.portC = 0;
    this.control = 0x9b;
    this.keyColumn = 0;
    this.cycles = 0;
    this.hz2400 = false;
    this.frameSync = false;
  }

  read(offset) {
    switch (offset & 3) {
      case 0: return this.portA;
      case 1: return this.keyboard.readColumn(this.keyColumn);
      case 2: return (this.portC & 0x0f) | (this.hz2400 ? 0x10 : 0) | (this.keyboard.repeat ? 0 : 0x40) | (this.frameSync ? 0x80 : 0);
      default: return this.control;
    }
  }

  write(offset, value) {
    const data = value & 0xff;
    switch (offset & 3) {
      case 0:
        this.portA = data;
        this.keyColumn = data & 0x0f;
        break;
      case 1:
        break;
      case 2:
        this.portC = data & 0x0f;
        break;
      default:
        if (data & 0x80) {
          this.control = data;
          this.portA = 0;
          this.portC = 0;
          this.keyColumn = 0;
        } else {
          const mask = 1 << ((data >> 1) & 7);
          if (data & 1) this.portC |= mask;
          else this.portC &= ~mask;
        }
    }
  }

  tick(cycles = 1) {
    this.cycles += cycles;
    this.hz2400 = (Math.floor(this.cycles / 208) & 1) !== 0;
    const frameCycle = this.cycles % 16667;
    this.frameSync = frameCycle >= 15667;
  }
}
