const IFR_T1 = 0x40;
const IFR_T2 = 0x20;
const IFR_CA1 = 0x02;
const IFR_CA2 = 0x01;

export class BbcKeyboardMatrix {
  constructor() { this.keys = new Set(); this.revision = 0; }
  press(code) { if (!this.keys.has(code)) { this.keys.add(code); this.revision += 1; } }
  release(code) { if (this.keys.delete(code)) this.revision += 1; }
  clear() { if (this.keys.size) { this.keys.clear(); this.revision += 1; } }
  get anyPressed() { return this.keys.size > 0; }
  hasColumn(column) { return [...this.keys].some((code) => Number(code.split(":", 1)[0]) === (column & 0x0f)); }
  isPressed(column, row) { return this.keys.has(`${column & 0x0f}:${row & 0x07}`); }
}

export class SystemVia6522 {
  constructor({ keyboard = new BbcKeyboardMatrix(), onSoundWrite = () => {} } = {}) {
    this.name = "System 6522 VIA";
    this.keyboard = keyboard;
    this.onSoundWrite = onSoundWrite;
    this.reset();
  }

  reset() {
    this.registers = new Uint8Array(16);
    this.outputA = 0xff; this.outputB = 0xff; this.ddra = 0; this.ddrb = 0;
    this.timer1 = 0xffff; this.timer1Latch = 0xffff; this.timer1Running = false;
    this.timer2 = 0xffff; this.timer2Running = false; this.timerRemainder = 0;
    this.ifr = 0; this.ier = 0; this.latch = new Array(8).fill(true); this.keyboardRevision = this.keyboard.revision;
  }

  get irq() { return (this.ifr & this.ier & 0x7f) !== 0; }

  read(offset) {
    const register = offset & 0x0f;
    switch (register) {
      case 0: return (this.outputB & this.ddrb) | (0xff & ~this.ddrb);
      case 1: { const value = this.#readPortA(); this.ifr &= ~(IFR_CA1 | IFR_CA2); return value; }
      case 15: return this.#readPortA();
      case 2: return this.ddrb; case 3: return this.ddra;
      case 4: { const value = this.timer1 & 0xff; this.ifr &= ~IFR_T1; return value; }
      case 5: return this.timer1 >> 8;
      case 6: return this.timer1Latch & 0xff; case 7: return this.timer1Latch >> 8;
      case 8: { const value = this.timer2 & 0xff; this.ifr &= ~IFR_T2; return value; }
      case 9: return this.timer2 >> 8;
      case 13: return this.ifr | (this.irq ? 0x80 : 0);
      case 14: return this.ier | 0x80;
      default: return this.registers[register];
    }
  }

  write(offset, value) {
    const register = offset & 0x0f; const data = value & 0xff;
    this.registers[register] = data;
    switch (register) {
      case 0: this.outputB = data; this.#updateLatch(); break;
      case 1: this.outputA = data; this.ifr &= ~(IFR_CA1 | IFR_CA2); break;
      case 15: this.outputA = data; break;
      case 2: this.ddrb = data; break; case 3: this.ddra = data; break;
      case 4: this.timer1Latch = (this.timer1Latch & 0xff00) | data; break;
      case 5: this.timer1Latch = data << 8 | (this.timer1Latch & 0xff); this.timer1 = this.timer1Latch; this.timer1Running = true; this.ifr &= ~IFR_T1; break;
      case 6: this.timer1Latch = (this.timer1Latch & 0xff00) | data; break;
      case 7: this.timer1Latch = data << 8 | (this.timer1Latch & 0xff); break;
      case 8: this.timer2 = (this.timer2 & 0xff00) | data; break;
      case 9: this.timer2 = data << 8 | (this.timer2 & 0xff); this.timer2Running = true; this.ifr &= ~IFR_T2; break;
      case 13: this.ifr &= ~(data & 0x7f); break;
      case 14: if (data & 0x80) this.ier |= data & 0x7f; else this.ier &= ~(data & 0x7f); break;
    }
  }

  tick(machineTicks) {
    this.timerRemainder += machineTicks;
    const viaTicks = Math.floor(this.timerRemainder / 2);
    this.timerRemainder %= 2;
    for (let count = 0; count < viaTicks; count += 1) {
      if (this.timer1Running && this.timer1-- === 0) {
        this.ifr |= IFR_T1;
        if (this.registers[11] & 0x40) this.timer1 = this.timer1Latch;
        else this.timer1Running = false;
      }
      if (this.timer2Running && this.timer2-- === 0) { this.ifr |= IFR_T2; this.timer2Running = false; }
    }
    if (this.keyboard.anyPressed && !this.latch[3] && this.keyboard.hasColumn(this.outputA)) this.ifr |= IFR_CA2;
    else if (this.keyboard.anyPressed && this.keyboard.revision !== this.keyboardRevision) this.ifr |= IFR_CA2;
    this.keyboardRevision = this.keyboard.revision;
  }

  signalVerticalSync() { this.ifr |= IFR_CA1; }

  saveState() {
    return {
      registers: Array.from(this.registers), outputA: this.outputA, outputB: this.outputB, ddra: this.ddra, ddrb: this.ddrb,
      timer1: this.timer1, timer1Latch: this.timer1Latch, timer1Running: this.timer1Running,
      timer2: this.timer2, timer2Running: this.timer2Running, timerRemainder: this.timerRemainder,
      ifr: this.ifr, ier: this.ier, latch: [...this.latch], keyboard: [...this.keyboard.keys],
    };
  }
  loadState(state) {
    this.registers.set(state.registers); this.outputA = state.outputA; this.outputB = state.outputB; this.ddra = state.ddra; this.ddrb = state.ddrb;
    this.timer1 = state.timer1; this.timer1Latch = state.timer1Latch; this.timer1Running = Boolean(state.timer1Running);
    this.timer2 = state.timer2; this.timer2Running = Boolean(state.timer2Running); this.timerRemainder = state.timerRemainder;
    this.ifr = state.ifr; this.ier = state.ier; this.latch = [...state.latch]; this.keyboard.keys = new Set(state.keyboard ?? []); this.keyboard.revision += 1; this.keyboardRevision = this.keyboard.revision;
  }

  #updateLatch() {
    const address = this.outputB & 7; const value = (this.outputB & 8) !== 0;
    this.latch[address] = value;
    if (address === 0 && !value) this.onSoundWrite(this.outputA);
  }
  #readPortA() {
    let input = 0xff;
    if (!this.latch[3]) {
      const column = this.outputA & 0x0f;
      const row = (this.outputA >> 4) & 0x07;
      input = (this.outputA & 0x7f) | (this.keyboard.isPressed(column, row) ? 0x80 : 0);
      return (this.outputA & this.ddra & 0x7f) | (input & (~this.ddra | 0x80));
    }
    return (this.outputA & this.ddra) | (input & ~this.ddra);
  }
}

export const BBC_KEYBOARD_CODES = Object.freeze({
  KeyQ: [0, 1], Digit3: [1, 1], Digit4: [2, 1], Digit5: [3, 1], F4: [4, 1], Digit8: [5, 1], F7: [6, 1], Minus: [7, 1], ArrowLeft: [9, 1],
  F10: [0, 2], KeyW: [1, 2], KeyE: [2, 2], KeyT: [3, 2], Digit7: [4, 2], KeyI: [5, 2], Digit9: [6, 2], Digit0: [7, 2], ArrowDown: [9, 2],
  Digit1: [0, 3], Digit2: [1, 3], KeyD: [2, 3], KeyR: [3, 3], Digit6: [4, 3], KeyU: [5, 3], KeyO: [6, 3], KeyP: [7, 3], BracketLeft: [8, 3], ArrowUp: [9, 3],
  KeyA: [1, 4], KeyX: [2, 4], KeyF: [3, 4], KeyY: [4, 4], KeyJ: [5, 4], KeyK: [6, 4], Quote: [7, 4], Semicolon: [8, 4], Enter: [9, 4],
  KeyS: [1, 5], KeyC: [2, 5], KeyG: [3, 5], KeyH: [4, 5], KeyN: [5, 5], KeyL: [6, 5], BracketRight: [8, 5], Backspace: [9, 5],
  Tab: [0, 6], KeyZ: [1, 6], Space: [2, 6], KeyV: [3, 6], KeyB: [4, 6], KeyM: [5, 6], Comma: [6, 6], Period: [7, 6], Slash: [8, 6],
  Escape: [0, 7], F1: [1, 7], F2: [2, 7], F3: [3, 7], F5: [4, 7], F6: [5, 7], F8: [6, 7], F9: [7, 7], Backslash: [8, 7], ArrowRight: [9, 7],
  ShiftLeft: [0, 0], ShiftRight: [0, 0], ControlLeft: [1, 0], ControlRight: [1, 0],
});

export function bbcKeyboardCodeForBrowserEvent(code, key) {
  // A modern US keyboard produces double quote from Shift+Quote, while the
  // BBC keyboard produces it from Shift+2. Preserve the character the user
  // intended and let the separately held Shift matrix key provide the case.
  if (key === '"') return BBC_KEYBOARD_CODES.Digit2;
  return BBC_KEYBOARD_CODES[code] ?? null;
}
