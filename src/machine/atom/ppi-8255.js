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

export const ATOM_KEYBOARD_CODES = Object.freeze({
  Escape: [0, 5], Digit3: [0, 1], Minus: [0, 2], KeyG: [0, 3], KeyQ: [0, 4],
  Digit2: [1, 1], Comma: [1, 2], KeyF: [1, 3], KeyP: [1, 4], KeyZ: [1, 5],
  Vertical: [2, 0], Digit1: [2, 1], Semicolon: [2, 2], KeyE: [2, 3], KeyO: [2, 4], KeyY: [2, 5],
  Horizontal: [3, 0], Digit0: [3, 1], Colon: [3, 2], KeyD: [3, 3], KeyN: [3, 4], KeyX: [3, 5],
  CapsLock: [4, 0], Delete: [4, 1], Digit9: [4, 2], KeyC: [4, 3], KeyM: [4, 4], KeyW: [4, 5],
  Caret: [5, 0], Tab: [5, 1], Digit8: [5, 2], KeyB: [5, 3], KeyL: [5, 4], KeyV: [5, 5],
  BracketRight: [6, 0], Enter: [6, 1], Digit7: [6, 2], KeyA: [6, 3], KeyK: [6, 4], KeyU: [6, 5],
  Backslash: [7, 0], Digit6: [7, 2], At: [7, 3], KeyJ: [7, 4], KeyT: [7, 5],
  BracketLeft: [8, 0], Digit5: [8, 2], Slash: [8, 3], KeyI: [8, 4], KeyS: [8, 5],
  Space: [9, 0], Digit4: [9, 2], Period: [9, 3], KeyH: [9, 4], KeyR: [9, 5],
});

export const ATOM_PRINTABLE_KEYBOARD = Object.freeze(createPrintableMap());

export function atomKeyboardMappingForBrowserEvent(code, key) {
  if (typeof key === "string" && key.length === 1 && ATOM_PRINTABLE_KEYBOARD[key]) return ATOM_PRINTABLE_KEYBOARD[key];
  const special = {
    Enter: mapping("Enter"), NumpadEnter: mapping("Enter"), Backspace: mapping("Delete"), Delete: mapping("Delete"),
    Escape: mapping("Escape"), Tab: mapping("Tab"), CapsLock: mapping("CapsLock"),
    ArrowUp: mapping("Vertical"), ArrowDown: mapping("Vertical", true), ArrowRight: mapping("Horizontal"), ArrowLeft: mapping("Horizontal", true),
  };
  return special[code] ?? null;
}

function createPrintableMap() {
  const map = {};
  const pair = (name, plain, shifted) => { map[plain] = mapping(name); if (shifted) map[shifted] = mapping(name, true); };
  pair("Digit1", "1", "!"); pair("Digit2", "2", '"'); pair("Digit3", "3", "#"); pair("Digit4", "4", "$"); pair("Digit5", "5", "%");
  pair("Digit6", "6", "&"); pair("Digit7", "7", "'"); pair("Digit8", "8", "("); pair("Digit9", "9", ")"); pair("Digit0", "0");
  pair("Minus", "-", "="); pair("Semicolon", ";", "+"); pair("Colon", ":", "*"); pair("Comma", ",", "<"); pair("Period", ".", ">"); pair("Slash", "/", "?");
  pair("BracketLeft", "["); pair("BracketRight", "]"); pair("Backslash", "\\"); pair("At", "@"); pair("Caret", "^"); pair("Space", " ");
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") { map[letter] = mapping(`Key${letter}`); map[letter.toLowerCase()] = mapping(`Key${letter}`, true); }
  return map;
}

function mapping(name, shift = false) { return Object.freeze({ matrix: ATOM_KEYBOARD_CODES[name], shift }); }

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
    this.cassetteInput = false;
  }

  read(offset) {
    switch (offset & 3) {
      case 0: return this.portA;
      case 1: return this.keyboard.readColumn(this.keyColumn);
      case 2: return (this.portC & 0x0f) | (this.hz2400 ? 0x10 : 0) | (this.cassetteInput ? 0x20 : 0) | (this.keyboard.repeat ? 0 : 0x40) | (this.frameSync ? 0x80 : 0);
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
