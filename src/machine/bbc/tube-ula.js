const CHANNELS = 4;

export class TubeUla {
  constructor() { this.name = "Tube ULA"; this.reset(); }

  reset() {
    this.control = 0;
    this.hostToParasite = Array.from({ length: CHANNELS }, () => []);
    this.parasiteToHost = Array.from({ length: CHANNELS }, () => []);
  }

  read(offset) { return this.#read("host", offset); }
  write(offset, value) {
    const register = offset & 0x07;
    if (register === 0) { this.#writeControl(value); return; }
    this.#write("host", register, value);
  }
  parasiteRead(offset) { return this.#read("parasite", offset); }
  parasiteWrite(offset, value) { this.#write("parasite", offset, value); }

  get hostIrq() { return (this.control & 0x01) !== 0 && this.parasiteToHost[3].length > 0; }
  get parasiteIrq() { return ((this.control & 0x02) !== 0 && this.hostToParasite[0].length > 0) || ((this.control & 0x04) !== 0 && this.hostToParasite[3].length > 0); }
  get parasiteNmi() { return (this.control & 0x08) !== 0 && this.hostToParasite[2].length > 0; }
  get parasiteReset() { return (this.control & 0x20) !== 0; }

  saveState() {
    return { control: this.control, hostToParasite: this.hostToParasite.map((queue) => [...queue]), parasiteToHost: this.parasiteToHost.map((queue) => [...queue]) };
  }

  loadState(state) {
    this.control = state?.control & 0x7f;
    this.hostToParasite = restoreQueues(state?.hostToParasite);
    this.parasiteToHost = restoreQueues(state?.parasiteToHost);
  }

  #read(side, offset) {
    const register = offset & 0x07;
    const channel = register >> 1;
    const incoming = side === "host" ? this.parasiteToHost[channel] : this.hostToParasite[channel];
    const outgoing = side === "host" ? this.hostToParasite[channel] : this.parasiteToHost[channel];
    if ((register & 1) === 0) return (incoming.length ? 0x80 : 0) | (outgoing.length < this.#capacity(side, channel) ? 0x40 : 0);
    return incoming.shift() ?? 0;
  }

  #write(side, offset, value) {
    const register = offset & 0x07;
    if ((register & 1) === 0) return;
    const channel = register >> 1;
    const outgoing = side === "host" ? this.hostToParasite[channel] : this.parasiteToHost[channel];
    if (outgoing.length >= this.#capacity(side, channel)) return;
    outgoing.push(value & 0xff);
  }

  #writeControl(value) {
    const mask = value & 0x7f;
    this.control = (value & 0x80) !== 0 ? this.control | mask : this.control & ~mask;
  }

  #capacity(side, channel) {
    if (channel === 0 && side === "parasite") return 24;
    if (channel === 2) return (this.control & 0x10) !== 0 ? 2 : 1;
    return 1;
  }
}

function restoreQueues(queues) {
  return Array.from({ length: CHANNELS }, (_, channel) => Array.from(queues?.[channel] ?? [], (value) => value & 0xff).slice(0, channel === 0 ? 24 : channel === 2 ? 2 : 1));
}
