/**
 * Emulasi modul LCD I²C: ekspander PCF8574 yang menggerakkan HD44780 dalam mode 4 bit.
 * Bit PCF8574: P0 = RS, P1 = RW, P2 = E, P3 = lampu latar, P4–P7 = D4–D7.
 */
export class LcdI2C {
  constructor(address, { cols = 16, rows = 2 } = {}) {
    this.address = address;
    this.cols = cols;
    this.rows = rows;
    this.reset();
  }

  reset() {
    this.ddram = new Uint8Array(0x80).fill(0x20);
    this.addr = 0;
    this.increment = 1;
    this.displayOn = false;
    this.backlight = false;
    this.fourBit = false;
    this.nibble = null; // nibble atas yang menunggu pasangannya
    this.lastE = 0;
    this.port = 0;
    this.dirty = true;
  }

  // --- antarmuka perangkat I²C ---
  write(byte) {
    const prevE = this.port & 0x04;
    this.port = byte;
    const bl = !!(byte & 0x08);
    if (bl !== this.backlight) {
      this.backlight = bl;
      this.dirty = true;
    }
    // data dikunci pada tepi turun E
    if (prevE && !(byte & 0x04)) this.latch(byte);
    return true;
  }

  read() {
    return this.port;
  }

  latch(byte) {
    const rs = byte & 0x01;
    const value = byte & 0xf0;
    if (!this.fourBit) {
      // sebelum diatur ke mode 4 bit, tiap nibble dianggap perintah 8 bit (hanya bit atas yang tersambung)
      this.exec(rs, value);
      return;
    }
    if (this.nibble === null) {
      this.nibble = value;
      return;
    }
    const full = this.nibble | (value >> 4);
    this.nibble = null;
    this.exec(rs, full);
  }

  exec(rs, v) {
    this.dirty = true;
    if (rs) {
      this.ddram[this.addr & 0x7f] = v;
      this.addr = (this.addr + this.increment) & 0x7f;
      return;
    }
    if (v & 0x80) {
      this.addr = v & 0x7f; // set alamat DDRAM
    } else if (v & 0x40) {
      /* alamat CGRAM: karakter kustom tidak didukung */
    } else if (v & 0x20) {
      this.fourBit = !(v & 0x10); // function set: DL=0 -> 4 bit
      this.nibble = null;
    } else if (v & 0x08) {
      this.displayOn = !!(v & 0x04);
    } else if (v & 0x04) {
      this.increment = v & 0x02 ? 1 : -1;
    } else if (v & 0x02) {
      this.addr = 0; // home
    } else if (v & 0x01) {
      this.ddram.fill(0x20); // clear
      this.addr = 0;
    }
  }

  /** Isi layar sebagai baris teks. */
  lines() {
    const starts = [0x00, 0x40, 0x14, 0x54];
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      let s = '';
      for (let c = 0; c < this.cols; c++) {
        const code = this.ddram[starts[r] + c];
        s += code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : code === 0xdf ? '°' : ' ';
      }
      out.push(s);
    }
    return out;
  }
}
