import { createOLED, createNokia5110, createTM1637, createMax7219, createLogicAnalyzer, NOKIA_PINS } from '../parts/displays2.js';
import { createMPU6050, createBMP180, createDS18B20, createHX711, createIRReceiver, createIRRemote, createRFID, MPU_PINS, RFID_PINS } from '../parts/sensors2.js';
import { headerPins, legsAlongX } from './spec.js';

const I2C_PINS = { GND: 'Ground', VCC: '5 V', SCL: 'SCL (detak)', SDA: 'SDA (data)' };
const i2cAddress = (value, list) => ({
  key: 'address',
  label: 'Alamat I²C',
  type: 'choice',
  value,
  options: list.map((v) => ({ value: v, label: `0x${v.toString(16).toUpperCase()}` })),
});

export const oled = {
  type: 'oled-ssd1306',
  name: 'OLED 128×64 SSD1306',
  category: 'display',
  icon: 'lcd',
  desc: 'Layar grafis 0,96" lewat I²C (alamat 0x3C). Pakai Adafruit_SSD1306 + Adafruit_GFX.',
  surface: 'floor',
  create: () => createOLED({ cols: 128, rows: 64 }),
  props: [i2cAddress(0x3c, [0x3c, 0x3d])],
  pins: headerPins(I2C_PINS),
  behavior: { kind: 'oled', sda: 'SDA', scl: 'SCL', vcc: 'VCC', gnd: 'GND', addressProp: 'address', cols: 128, rows: 64, controller: 'ssd1306' },
};

export const sh1107 = {
  type: 'oled-sh1107',
  name: 'OLED 128×128 SH1107',
  category: 'display',
  icon: 'lcd',
  desc: 'Layar grafis 1,3" persegi lewat I²C (alamat 0x3C). Di Uno pakai U8g2 (mode halaman, mis. U8G2_SH1107_128X128_1_HW_I2C) — buffer penuh 2 KB tidak muat di RAM Uno.',
  surface: 'floor',
  create: () => createOLED({ cols: 128, rows: 128 }),
  props: [i2cAddress(0x3c, [0x3c, 0x3d])],
  pins: headerPins(I2C_PINS),
  behavior: { kind: 'oled', sda: 'SDA', scl: 'SCL', vcc: 'VCC', gnd: 'GND', addressProp: 'address', cols: 128, rows: 128, controller: 'sh1107' },
};

const NOKIA_LABEL = { RST: 'Reset', CE: 'Chip enable (CS)', DC: 'Data/perintah', DIN: 'Data (MOSI)', CLK: 'Detak (SCK)', VCC: '3,3–5 V', BL: 'Lampu latar', GND: 'Ground' };
export const nokia5110 = {
  type: 'nokia-5110',
  name: 'LCD Nokia 5110',
  category: 'display',
  icon: 'lcd',
  desc: 'Layar grafis 84×48 (PCD8544) lewat SPI. Pakai Adafruit_PCD8544.',
  surface: 'floor',
  create: () => createNokia5110(),
  pins: headerPins(Object.fromEntries(NOKIA_PINS.map((id) => [id, NOKIA_LABEL[id]]))),
  behavior: { kind: 'pcd8544', rst: 'RST', ce: 'CE', dc: 'DC', din: 'DIN', clk: 'CLK', vcc: 'VCC', gnd: 'GND', bl: 'BL' },
};

export const tm1637 = {
  type: 'tm1637',
  name: 'Display 4 digit TM1637',
  category: 'display',
  icon: 'lcd',
  desc: 'Empat digit + titik dua, cukup 2 kabel data. Pakai library TM1637 (TM1637Display).',
  surface: 'floor',
  create: () => createTM1637(),
  pins: headerPins({ CLK: 'Detak', DIO: 'Data', VCC: '5 V', GND: 'Ground' }),
  behavior: { kind: 'tm1637', clk: 'CLK', dio: 'DIO', vcc: 'VCC', gnd: 'GND' },
};

export const max7219 = {
  type: 'max7219-matrix',
  name: 'Matriks LED MAX7219',
  category: 'display',
  icon: 'ledbar',
  desc: 'Matriks LED 8×8 (bisa 4 berantai). Pakai LedControl atau MD_MAX72XX/MD_Parola (FC16_HW).',
  surface: 'floor',
  create: (props) => createMax7219({ count: props.count }),
  props: [
    {
      key: 'count',
      label: 'Jumlah modul',
      type: 'choice',
      value: 1,
      rebuild: true,
      options: [1, 2, 4].map((value) => ({ value, label: String(value) })),
    },
  ],
  pins: headerPins({ VCC: '5 V', GND: 'Ground', DIN: 'Data (MOSI)', CS: 'Chip select', CLK: 'Detak (SCK)' }),
  behavior: { kind: 'max7219', vcc: 'VCC', gnd: 'GND', din: 'DIN', cs: 'CS', clk: 'CLK', countProp: 'count' },
};

const CH = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
export const logicAnalyzer = {
  type: 'logic-analyzer',
  name: 'Logic analyzer 8 kanal',
  category: 'logic',
  icon: 'pulse',
  desc: 'Menampilkan 8 sinyal digital sebagai gelombang (jendela waktu bisa diatur).',
  surface: 'floor',
  create: () => createLogicAnalyzer(),
  props: [
    {
      key: 'window',
      label: 'Jendela waktu',
      type: 'choice',
      value: 20,
      options: [1, 5, 20, 100, 500, 2000].map((value) => ({ value, label: value >= 1000 ? `${value / 1000} s` : `${value} ms` })),
    },
  ],
  pins: headerPins({ ...Object.fromEntries(CH.map((id) => [id, `Kanal ${id}`])), GND: 'Ground' }),
  behavior: { kind: 'logic-analyzer', inputs: CH, gnd: 'GND', windowProp: 'window' },
};

const MPU_LABEL = { VCC: '5 V', GND: 'Ground', SCL: 'SCL', SDA: 'SDA', XDA: 'I²C tambahan (data)', XCL: 'I²C tambahan (detak)', AD0: 'Pilih alamat (LOW = 0x68)', INT: 'Interupsi' };
export const mpu6050 = {
  type: 'mpu6050',
  name: 'Akselerometer & giroskop MPU6050',
  category: 'sensor',
  icon: 'compass',
  desc: 'Percepatan dan kecepatan putar 3 sumbu lewat I²C (0x68, atau 0x69 bila AD0 HIGH). Pakai Adafruit_MPU6050.',
  surface: 'floor',
  create: () => createMPU6050(),
  props: [
    { key: 'ax', label: 'Percepatan X', type: 'range', min: -2, max: 2, step: 0.01, value: 0, unit: 'g' },
    { key: 'ay', label: 'Percepatan Y', type: 'range', min: -2, max: 2, step: 0.01, value: 0, unit: 'g' },
    { key: 'az', label: 'Percepatan Z', type: 'range', min: -2, max: 2, step: 0.01, value: 1, unit: 'g' },
    { key: 'gx', label: 'Putaran X', type: 'range', min: -250, max: 250, step: 1, value: 0, unit: '°/s' },
    { key: 'gy', label: 'Putaran Y', type: 'range', min: -250, max: 250, step: 1, value: 0, unit: '°/s' },
    { key: 'gz', label: 'Putaran Z', type: 'range', min: -250, max: 250, step: 1, value: 0, unit: '°/s' },
    { key: 'temp', label: 'Suhu', type: 'range', min: -40, max: 85, step: 0.5, value: 24, unit: '°C' },
  ],
  pins: headerPins(Object.fromEntries(MPU_PINS.map((id) => [id, MPU_LABEL[id]]))),
  behavior: { kind: 'mpu6050', sda: 'SDA', scl: 'SCL', vcc: 'VCC', gnd: 'GND', ad0: 'AD0' },
};

export const bmp180 = {
  type: 'bmp180',
  name: 'Sensor tekanan BMP180',
  category: 'sensor',
  icon: 'compass',
  desc: 'Tekanan udara dan suhu lewat I²C (0x77). Pakai Adafruit_BMP085.',
  surface: 'floor',
  create: () => createBMP180(),
  props: [
    { key: 'temp', label: 'Suhu', type: 'range', min: -40, max: 85, step: 0.1, value: 24, unit: '°C' },
    { key: 'pressure', label: 'Tekanan', type: 'range', min: 300, max: 1100, step: 0.5, value: 1013.25, unit: 'hPa' },
  ],
  pins: headerPins({ VIN: '5 V', GND: 'Ground', SCL: 'SCL', SDA: 'SDA' }),
  behavior: { kind: 'bmp180', sda: 'SDA', scl: 'SCL', vcc: 'VIN', gnd: 'GND', address: 0x77 },
};

export const ds18b20 = {
  type: 'ds18b20',
  name: 'Sensor suhu DS18B20',
  category: 'sensor',
  icon: 'thermo',
  desc: 'Sensor suhu digital satu kabel (OneWire). Pull-up 4,7 kΩ pada DQ sudah disimulasikan. Pakai OneWire + DallasTemperature.',
  surface: 'breadboard',
  create: () => createDS18B20(),
  props: [{ key: 'temp', label: 'Suhu (simulasi)', type: 'range', min: -55, max: 125, step: 0.0625, value: 22, unit: '°C' }],
  pins: legsAlongX([
    ['GND', 'Ground'],
    ['DQ', 'Data (OneWire)'],
    ['VDD', '5 V'],
  ]),
  behavior: { kind: 'ds18b20', dq: 'DQ', vdd: 'VDD', gnd: 'GND', tempProp: 'temp' },
};

export const hx711 = {
  type: 'hx711',
  name: 'Timbangan HX711 + load cell',
  category: 'sensor',
  icon: 'gear',
  desc: 'Penguat 24 bit untuk sel beban 5 kg. Pembacaan mentah = gram × 420 (gain 128). Pakai library HX711.',
  surface: 'floor',
  create: () => createHX711(),
  props: [{ key: 'grams', label: 'Beban', type: 'range', min: 0, max: 5000, step: 1, value: 1000, unit: 'g' }],
  pins: headerPins({ VCC: '5 V', GND: 'Ground', DT: 'Data', SCK: 'Detak' }),
  behavior: { kind: 'hx711', vcc: 'VCC', gnd: 'GND', dt: 'DT', sck: 'SCK', gramsProp: 'grams', scale: 420 },
};

export const irReceiver = {
  type: 'ir-receiver',
  name: 'Penerima IR',
  category: 'sensor',
  icon: 'sonar',
  desc: 'Menerima kode dari remote IR (protokol NEC). Pakai IRremote.',
  surface: 'floor',
  create: () => createIRReceiver(),
  pins: headerPins({ GND: 'Ground', VCC: '5 V', DAT: 'Data' }),
  behavior: { kind: 'ir-receiver', dat: 'DAT', vcc: 'VCC', gnd: 'GND' },
};

export const irRemote = {
  type: 'ir-remote',
  name: 'Remote IR',
  category: 'input',
  icon: 'keypad',
  desc: 'Klik tombolnya saat simulasi; semua penerima IR di meja menangkap kodenya.',
  surface: 'floor',
  create: () => createIRRemote(),
  pins: [],
  behavior: { kind: 'ir-remote' },
};

const RFID_LABEL = { SDA: 'Chip select (SS)', SCK: 'Detak (SCK)', MOSI: 'MOSI', MISO: 'MISO', IRQ: 'Interupsi', GND: 'Ground', RST: 'Reset', '3.3V': '3,3 V' };
export const rfid = {
  type: 'rfid-mfrc522',
  name: 'RFID MFRC522',
  category: 'sensor',
  icon: 'chip',
  desc: 'Pembaca kartu RFID lewat SPI (SCK D13, MOSI D11, MISO D12). Klik modul saat simulasi untuk menempelkan kartu.',
  surface: 'floor',
  create: () => createRFID(),
  props: [
    {
      key: 'uid',
      label: 'UID kartu',
      type: 'choice',
      value: 'DE AD BE EF',
      options: ['DE AD BE EF', '12 34 56 78', 'A1 B2 C3 D4'].map((value) => ({ value, label: value })),
    },
  ],
  pins: headerPins(Object.fromEntries(RFID_PINS.map((id) => [id, RFID_LABEL[id]]))),
  behavior: { kind: 'mfrc522', cs: 'SDA', sck: 'SCK', mosi: 'MOSI', miso: 'MISO', rst: 'RST', vcc: '3.3V', gnd: 'GND', uidProp: 'uid' },
};

export const WAVE2 = [oled, sh1107, nokia5110, tm1637, max7219, logicAnalyzer, mpu6050, bmp180, ds18b20, hx711, irReceiver, irRemote, rfid];
