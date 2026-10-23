import { createTFT, createEPaper, createMicroSD, TFT_PINS, EPD_PINS, SD_PINS } from '../parts/wave3.js';
import { createDIP } from '../parts/dip.js';
import { PITCH } from '../parts/lib.js';
import { headerPins } from './spec.js';

const TFT_LABEL = {
  VCC: '5 V',
  GND: 'Ground',
  CS: 'Chip select',
  RST: 'Reset',
  'D/C': 'Data/perintah',
  MOSI: 'MOSI (D11)',
  SCK: 'SCK (D13)',
  LED: 'Lampu latar',
  MISO: 'MISO (D12)',
  SCL: 'Sentuh SCL (A5)',
  SDA: 'Sentuh SDA (A4)',
};
const tftBehavior = { kind: 'ili9341', cs: 'CS', dc: 'D/C', rst: 'RST', mosi: 'MOSI', sck: 'SCK', miso: 'MISO', vcc: 'VCC', gnd: 'GND', led: 'LED' };

export const tft = {
  type: 'ili9341',
  name: 'TFT 2,8" ILI9341',
  category: 'display',
  icon: 'lcd',
  desc: 'Layar warna 240×320 lewat SPI (SCK D13, MOSI D11). Pakai Adafruit_ILI9341 + Adafruit_GFX.',
  surface: 'floor',
  create: () => createTFT(),
  pins: headerPins(Object.fromEntries(TFT_PINS.map((id) => [id, TFT_LABEL[id]]))),
  behavior: tftBehavior,
};

export const tftTouch = {
  type: 'ili9341-touch',
  name: 'TFT 2,8" ILI9341 + layar sentuh',
  category: 'display',
  icon: 'lcd',
  desc: 'Seperti TFT ILI9341, ditambah sentuh kapasitif FT6206 lewat I²C (0x38). Klik-tahan layar saat simulasi. Pakai Adafruit_FT6206.',
  surface: 'floor',
  create: () => createTFT({ touch: true }),
  pins: headerPins(Object.fromEntries([...TFT_PINS, 'SCL', 'SDA'].map((id) => [id, TFT_LABEL[id]]))),
  behavior: { ...tftBehavior, sda: 'SDA', scl: 'SCL', touch: true },
};

const EPD_LABEL = { BUSY: 'Sibuk (keluaran)', RST: 'Reset', DC: 'Data/perintah', CS: 'Chip select', CLK: 'SCK (D13)', DIN: 'MOSI (D11)', GND: 'Ground', VCC: '3,3–5 V' };
export const epaper = {
  type: 'epaper-2in9',
  name: 'e-Paper 2,9" (296×128)',
  category: 'display',
  icon: 'lcd',
  desc: 'Layar tinta elektronik hitam-putih (SSD1680). Pakai GxEPD2 (GxEPD2_290_T94) dengan buffer halaman, mis. GxEPD2_BW<…, 64>.',
  surface: 'floor',
  create: () => createEPaper(),
  pins: headerPins(Object.fromEntries(EPD_PINS.map((id) => [id, EPD_LABEL[id]]))),
  behavior: { kind: 'epaper', busy: 'BUSY', rst: 'RST', dc: 'DC', cs: 'CS', sck: 'CLK', mosi: 'DIN', vcc: 'VCC', gnd: 'GND', cols: 128, rows: 296 },
};

const SD_LABEL = { CD: 'Deteksi kartu', DO: 'Data keluar (MISO, D12)', GND: 'Ground', SCK: 'SCK (D13)', VCC: '5 V', DI: 'Data masuk (MOSI, D11)', CS: 'Chip select' };
export const microSD = {
  type: 'microsd',
  name: 'Kartu microSD',
  category: 'misc',
  icon: 'memory',
  desc: 'Kartu 32 MB (FAT16) lewat SPI. Pakai library SD. Isi kartu tetap tersimpan selama halaman terbuka; daftar berkas muncul di Serial Monitor saat simulasi berhenti.',
  surface: 'floor',
  create: () => createMicroSD(),
  pins: headerPins(Object.fromEntries(SD_PINS.map((id) => [id, SD_LABEL[id]]))),
  behavior: { kind: 'microsd', cs: 'CS', sck: 'SCK', mosi: 'DI', miso: 'DO', cd: 'CD', vcc: 'VCC', gnd: 'GND' },
};

// NLSF595: susunan kaki sama dengan 74HC595, nama pin mengikuti datasheet ON Semi
const NLSF = ['QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'GND', 'SQH', 'SCLR', 'SCK', 'RCK', 'G', 'SI', 'QA', 'VCC'];
const NLSF_LABEL = { GND: 'Ground', VCC: '5 V', SI: 'Data serial', SCK: 'Detak geser', RCK: 'Kunci / latch', G: 'Output enable (aktif LOW)', SCLR: 'Reset (aktif LOW)', SQH: 'Keluaran berantai' };
export const nlsf595 = {
  type: 'nlsf595',
  name: 'Driver LED RGB NLSF595',
  category: 'basic',
  icon: 'chip',
  desc: 'Register geser 8 bit berarus besar untuk LED RGB (pinout = 74HC595). Pakai shiftOut().',
  surface: 'breadboard',
  create: () => createDIP({ pins: 16, label: 'NLSF595', key: 'nlsf595', name: 'NLSF595', desc: 'Register geser 8 bit untuk LED RGB.' }),
  pins: NLSF.map((id, i) => {
    const front = i < 8;
    const x = front ? (i - 3.5) * PITCH : (15 - i - 3.5) * PITCH;
    return { id, name: `${i + 1} · ${NLSF_LABEL[id] ?? `Keluaran ${id}`}`, at: [x, 0, front ? 3.81 : -3.81] };
  }),
  behavior: {
    kind: 'hc595',
    vcc: 'VCC',
    gnd: 'GND',
    data: 'SI',
    shift: 'SCK',
    latch: 'RCK',
    oe: 'G',
    mr: 'SCLR',
    outputs: ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'],
    chain: 'SQH',
  },
};

export const WAVE3 = [tft, tftTouch, epaper, microSD, nlsf595];
