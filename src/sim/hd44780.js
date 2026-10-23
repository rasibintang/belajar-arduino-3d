/**
 * Inti pengendali LCD karakter HD44780.
 * Data masuk per "detak" E: dalam mode 8 bit satu byte penuh, dalam mode 4 bit dua nibble
 * (nibble atas dulu). Sebelum "function set" 4 bit diterima, hanya D7–D4 yang dipakai.
 */
export class HD44780 {
  constructor({ cols = 16, rows = 2 } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.reset();
  }

  reset() {
    this.ddram = new Uint8Array(0x80).fill(0x20);
    this.addr = 0;
    this.increment = 1;
    this.displayOn = false;
    this.fourBit = false;
    this.nibble = null; // nibble atas yang menunggu pasangannya
  }

  /** Satu detak E (tepi turun). byte = D7..D0 (pada mode 4 bit hanya D7–D4 berarti). */
  clock(rs, byte) {
    if (!this.fourBit) {
      this.exec(rs, byte);
      return;
    }
    const hi = byte & 0xf0;
    if (this.nibble === null) {
      this.nibble = hi;
      return;
    }
    const full = this.nibble | (hi >> 4);
    this.nibble = null;
    this.exec(rs, full);
  }

  exec(rs, v) {
    if (rs) {
      this.ddram[this.addr & 0x7f] = v;
      this.addr = (this.addr + this.increment) & 0x7f;
      return;
    }
    if (v & 0x80) this.addr = v & 0x7f; // alamat DDRAM
    else if (v & 0x40) {
      /* CGRAM (karakter kustom) belum didukung */
    } else if (v & 0x20) {
      this.fourBit = !(v & 0x10); // function set: DL = 0 -> 4 bit
      this.nibble = null;
    } else if (v & 0x08) this.displayOn = !!(v & 0x04);
    else if (v & 0x04) this.increment = v & 0x02 ? 1 : -1;
    else if (v & 0x02) this.addr = 0; // home
    else if (v & 0x01) {
      this.ddram.fill(0x20); // clear
      this.addr = 0;
    }
  }

  /** Isi layar sebagai baris teks. */
  lines() {
    const starts = [0x00, 0x40, this.cols, 0x40 + this.cols]; // 20×4: 0x00, 0x40, 0x14, 0x54
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      let s = '';
      for (let c = 0; c < this.cols; c++) {
        const code = this.ddram[(starts[r] + c) & 0x7f];
        s += code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : code === 0xdf ? '°' : ' ';
      }
      out.push(s);
    }
    return out;
  }
}

/**
 * Modul LCD I²C: ekspander PCF8574 yang menggerakkan HD44780 dalam mode 4 bit.
 * Bit PCF8574: P0 = RS, P1 = RW, P2 = E, P3 = lampu latar, P4–P7 = D4–D7.
 */
export class LcdI2C extends HD44780 {
  constructor(address, opts) {
    super(opts);
    this.address = address;
    this.backlight = false;
    this.port = 0;
  }

  write(byte) {
    const prevE = this.port & 0x04;
    this.port = byte;
    this.backlight = !!(byte & 0x08);
    if (prevE && !(byte & 0x04)) this.clock(byte & 0x01, byte & 0xf0);
    return true;
  }

  read() {
    return this.port;
  }
}
