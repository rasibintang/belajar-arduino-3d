import {
  CPU,
  avrInstruction,
  AVRTimer,
  timer0Config,
  timer1Config,
  timer2Config,
  AVRIOPort,
  portBConfig,
  portCConfig,
  portDConfig,
  AVRUSART,
  usart0Config,
  AVRADC,
  adcConfig,
  AVRTWI,
  twiConfig,
  AVREEPROM,
  EEPROMMemoryBackend,
  AVRClock,
  clockConfig,
  PinState,
} from 'avr8js';
import { loadHex } from './hex.js';

export const FREQ = 16e6;
export { PinState };

/** Pin header Uno -> [port, bit]. SDA/SCL di header digital = A4/A5. */
export const UNO_PINS = {};
for (let i = 0; i <= 7; i++) UNO_PINS[`D${i}`] = ['D', i];
for (let i = 8; i <= 13; i++) UNO_PINS[`D${i}`] = ['B', i - 8];
for (let i = 0; i <= 5; i++) UNO_PINS[`A${i}`] = ['C', i];
UNO_PINS.SDA = ['C', 4];
UNO_PINS.SCL = ['C', 5];

const PIN_REG = { B: 0x23, C: 0x26, D: 0x29 };

/**
 * Bus I²C sederhana: meneruskan kejadian TWI ke perangkat sesuai alamat.
 * Perangkat: { address, start?(), stop?(), write(byte) -> ack, read() -> byte }
 */
class I2CBus {
  constructor(twi) {
    this.twi = twi;
    this.devices = new Map();
    this.active = null;
  }
  start() {
    this.twi.completeStart();
  }
  stop() {
    this.active?.stop?.();
    this.active = null;
    this.twi.completeStop();
  }
  connectToSlave(addr, write) {
    const dev = this.devices.get(addr) ?? null;
    this.active = dev;
    dev?.start?.(write);
    this.twi.completeConnect(!!dev);
  }
  writeByte(value) {
    this.twi.completeWrite(this.active ? this.active.write(value) !== false : false);
  }
  readByte(ack) {
    this.twi.completeRead(this.active ? this.active.read(ack) & 0xff : 0xff);
  }
}

/**
 * ATmega328P teremulasi (avr8js) dengan semua periferal yang dipakai Arduino Uno.
 *
 * Kait (hooks) yang bisa diisi:
 *   onPortChange(portName)   — PORT/DDR berubah (digitalWrite, pinMode, PWM)
 *   onPinRead()              — sketch akan membaca register PIN (untuk menghitung ulang rangkaian)
 *   onAnalogRead(channel)    — analogRead dimulai; isi adc.channelValues[channel]
 *   onSerial(byte)           — Serial.write dari sketch
 */
export class AVRRunner {
  constructor(hex, { eeprom } = {}) {
    this.program = new Uint16Array(0x8000 / 2);
    loadHex(hex, new Uint8Array(this.program.buffer));
    this.eepromMemory = eeprom ?? new EEPROMMemoryBackend(1024);
    this.hooks = {};
    this.build();
  }

  build() {
    const cpu = (this.cpu = new CPU(this.program));
    this.timers = [timer0Config, timer1Config, timer2Config].map((c) => new AVRTimer(cpu, c));
    this.clock = new AVRClock(cpu, FREQ, clockConfig);
    this.ports = { B: new AVRIOPort(cpu, portBConfig), C: new AVRIOPort(cpu, portCConfig), D: new AVRIOPort(cpu, portDConfig) };
    this.usart = new AVRUSART(cpu, usart0Config, FREQ);
    this.adc = new AVRADC(cpu, adcConfig);
    this.twi = new AVRTWI(cpu, twiConfig, FREQ);
    this.eeprom = new AVREEPROM(cpu, this.eepromMemory);
    this.i2c = new I2CBus(this.twi);
    this.twi.eventHandler = this.i2c;

    for (const [name, port] of Object.entries(this.ports)) {
      port.addListener(() => this.hooks.onPortChange?.(name));
      // baca PIN: hitung ulang rangkaian dulu agar nilai input selalu terbaru
      const addr = PIN_REG[name];
      cpu.readHooks[addr] = () => {
        this.hooks.onPinRead?.();
        return cpu.data[addr];
      };
    }
    const readAdc = this.adc.onADCRead;
    this.adc.onADCRead = (input) => {
      if (input.channel !== undefined) this.hooks.onAnalogRead?.(input.channel);
      readAdc(input);
    };
    this.usart.onByteTransmit = (b) => this.hooks.onSerial?.(b);
    this.rxQueue = [];
    this.usart.onRxComplete = () => this.feedSerial();
  }

  /** Mulai ulang dari awal (tombol RESET); program & EEPROM tetap. */
  reset() {
    const { hooks, i2c } = this;
    const devices = i2c.devices;
    this.build();
    this.hooks = hooks;
    this.i2c.devices = devices;
  }

  get cycles() {
    return this.cpu.cycles;
  }

  /** Keadaan pin: PinState.Low/High/Input/InputPullUp */
  pinState(name) {
    const [port, bit] = UNO_PINS[name];
    return this.ports[port].pinState(bit);
  }

  setPin(name, value) {
    const [port, bit] = UNO_PINS[name];
    this.ports[port].setPin(bit, value);
  }

  /** Kirim teks dari Serial Monitor (byte demi byte, menunggu buffer RX kosong). */
  sendSerial(text) {
    for (const ch of new TextEncoder().encode(text)) this.rxQueue.push(ch);
    this.feedSerial();
  }

  feedSerial() {
    while (this.rxQueue.length && !this.usart.rxBusy) {
      if (this.usart.writeByte(this.rxQueue[0]) === false) break;
      this.rxQueue.shift();
    }
  }

  /** Jalankan sampai `untilCycles` tercapai atau anggaran waktu habis. Mengembalikan siklus yang dijalankan. */
  run(untilCycles, budgetMs = 14) {
    const cpu = this.cpu;
    const start = cpu.cycles;
    const deadline = performance.now() + budgetMs;
    while (cpu.cycles < untilCycles) {
      // periksa waktu setiap ± 50.000 siklus agar tidak terlalu sering memanggil performance.now()
      const stop = Math.min(untilCycles, cpu.cycles + 50000);
      while (cpu.cycles < stop) {
        avrInstruction(cpu);
        cpu.tick();
      }
      if (performance.now() > deadline) break;
    }
    if (this.rxQueue.length) this.feedSerial();
    return cpu.cycles - start;
  }

  /** Alamat byte instruksi yang sedang dijalankan (untuk sorotan baris kode). */
  get pcBytes() {
    return this.cpu.pc * 2;
  }
}
