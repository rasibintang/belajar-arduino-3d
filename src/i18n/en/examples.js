// English titles, descriptions and sketch replacements for the sandbox examples.
// replace: [from, to] applied to the sketch in order; `from` may be a string or a RegExp.
const word = (w) => new RegExp(`\\b${w}\\b`, 'g');

export const EXAMPLES_EN = {
  blink: { title: 'Blink (built-in LED)', desc: 'The “L” LED on the board blinks every second.', replace: [['// LED "L" di papan tersambung ke pin 13', '// The "L" LED on the board is wired to pin 13']] },
  led: { title: 'LED + resistor', desc: 'Your first circuit on a breadboard.' },
  button: { title: 'Button & LED', desc: 'Hold the button (click in 3D) to light the LED.', replace: [['"Ditekan" : "Dilepas"', '"Pressed" : "Released"']] },
  pot: { title: 'Potentiometer → dimmed LED', desc: 'analogRead() and analogWrite(). Drag the knob while it runs.' },
  servo: { title: 'Servo sweep', desc: 'Servo library: 0° → 180° and back.' },
  buzzer: { title: 'Buzzer melody', desc: 'tone() plays a scale.' },
  lcd: {
    title: 'LCD “Hello, world!”',
    desc: 'LiquidCrystal_I2C through A4/A5.',
    replace: [
      ['"Halo, dunia!"', '"Hello, world!"'],
      ['"Detik: "', '"Seconds: "'],
    ],
  },
  sonar: { title: 'HC-SR04 distance sensor', desc: 'pulseIn() times the echo. Click the sensor to change the distance.', replace: [['"Jarak: "', '"Distance: "']] },
  rgb: { title: 'Rainbow RGB LED', desc: 'analogWrite() on three PWM pins.' },
  ldr: { title: 'Night light (LDR)', desc: 'Click the LDR to change the light.' },
  seg7: { title: 'Count 0–9 (7-segment)', desc: 'An array of segment patterns; one resistor on the cathode.', replace: [['// Segmen A..G di pin 2..8', '// Segments A..G on pins 2..8']] },
  hc595: { title: '74HC595 shift register', desc: '8 LEDs from 3 pins with shiftOut().' },
  motor: { title: 'DC motor + transistor', desc: 'PWM through a TIP120 transistor.' },
  neopixel: { title: 'Rainbow NeoPixel', desc: 'Adafruit NeoPixel library, one data pin.' },
  dht: {
    title: 'Temperature & humidity (DHT11)',
    desc: 'Click the sensor to change the weather.',
    replace: [
      ['"Suhu: "', '"Temp: "'],
      ['" C  Lembap: "', '" C  Humidity: "'],
    ],
  },
  rtc: { title: 'RTC clock + LCD', desc: 'RTClib and the LCD share the I²C bus.', replace: [[word('dua'), 'two']] },
  stepper: { title: 'Stepper motor', desc: 'Stepper library: half a turn back and forth.' },
  keypad: { title: '4×4 keypad', desc: 'Click the keys; the characters appear in Serial.' },
  joystick: { title: 'Joystick → Serial', desc: 'Drag the stick while the simulation runs.', replace: [['"  [KLIK]"', '"  [CLICK]"']] },
  encoder: {
    title: 'Rotary encoder + interrupt',
    desc: 'Drag the knob; the position is counted by an interrupt.',
    replace: [
      ['"Putar kenopnya!"', '"Turn the knob!"'],
      ['"Posisi: "', '"Position: "'],
    ],
  },
  relay: { title: 'Blinking relay', desc: 'Listen to the relay click.' },
  logic: {
    title: 'Truth table',
    desc: 'The Arduino feeds A and B to AND & XOR gates and reads the results.',
    replace: [['// Gerbang logika ideal: tidak perlu catu daya.', '// Ideal logic gates: no power supply needed.']],
  },
  'lcd-parallel': {
    title: 'Parallel 16×2 LCD',
    desc: 'The LiquidCrystal library in 4-bit mode.',
    replace: [
      ['"Halo, Arduino!"', '"Hello, Arduino!"'],
      ['"Detik: "', '"Seconds: "'],
    ],
  },
  a4988: {
    title: 'NEMA 17 stepper + A4988',
    desc: 'One STEP pulse = 1.8°. One full turn back and forth.',
    replace: [
      ['// satu putaran penuh', '// one full turn'],
      [word('putar'), 'turn'],
      [word('langkah'), 'steps'],
      [word('searah'), 'clockwise'],
    ],
  },
  'neopixel-matrix': { title: 'NeoPixel matrix 8×8', desc: 'A rainbow dot running over 64 LEDs.' },
  pir: {
    title: 'PIR motion alarm',
    desc: 'Click the PIR sensor during the simulation to “move” in front of it.',
    replace: [
      ['"Menunggu gerakan..."', '"Waiting for motion..."'],
      ['"Ada gerakan!"', '"Motion detected!"'],
      ['"Sepi lagi."', '"All quiet again."'],
      [word('tadi'), 'before'],
      [word('ada'), 'motion'],
    ],
  },
  oled: {
    title: 'SSD1306 OLED',
    desc: 'Text and graphics on a 128×64 screen over I²C.',
    replace: [
      ['"Halo!"', '"Hello!"'],
      ['"Detik: "', '"Seconds: "'],
      ['// batang yang memanjang tiap detik', '// a bar that grows every second'],
      [word('layar'), 'display'],
    ],
  },
  tm1637: {
    title: 'TM1637 clock',
    desc: 'Minutes:seconds since power-up, with a blinking colon.',
    replace: [
      [word('layar'), 'display'],
      [word('titik'), 'colon'],
    ],
  },
  max7219: {
    title: 'MAX7219 scrolling text',
    desc: 'Four 8×8 matrices + MD_Parola.',
    replace: [
      ['"Halo Arduino!"', '"Hello Arduino!"'],
      ['// CS = 10, 4 modul', '// CS = 10, 4 modules'],
      [word('layar'), 'display'],
    ],
  },
  ds18b20: { title: 'DS18B20 thermometer', desc: 'OneWire + DallasTemperature. Change the temperature in the component panel.', replace: [['"Suhu: "', '"Temperature: "']] },
  ir: {
    title: 'IR remote',
    desc: 'Click the remote buttons during the simulation; the codes appear in the Serial Monitor.',
    replace: [
      ['"Tekan tombol remote..."', '"Press a remote button..."'],
      ['"Kode: "', '"Code: "'],
      [word('kode'), 'code'],
    ],
  },
  rfid: { title: 'RFID reader', desc: 'Click the RFID module during the simulation to tap a card.', replace: [['"Tempelkan kartu..."', '"Tap a card..."']] },
  mpu6050: {
    title: 'MPU6050 tilt',
    desc: 'Change the acceleration in the component panel and watch the angle.',
    replace: [
      ['"MPU6050 tidak ditemukan!"', '"MPU6050 not found!"'],
      ['"Miring: "', '"Tilt: "'],
      ['" derajat"', '" degrees"'],
      [word('miring'), 'tilt'],
    ],
  },
  tft: {
    title: 'Color ILI9341 TFT',
    desc: 'Text, shapes and a rainbow on a 240×320 screen.',
    replace: [
      ['// pita pelangi', '// rainbow stripes'],
      ['"Halo TFT!"', '"Hello TFT!"'],
      ['"Detik: "', '"Seconds: "'],
      [word('warna'), 'colors'],
    ],
  },
  'tft-touch': {
    title: 'Touch drawing pad',
    desc: 'Click and hold the TFT screen during the simulation to draw.',
    replace: [
      ['"Sentuh layar!"', '"Touch the screen!"'],
      ['// panel sentuh terpasang terbalik terhadap layar', '// the touch panel is mounted flipped relative to the display'],
      [word('sentuh'), 'touch'],
    ],
  },
  epaper: {
    title: '2.9" e-Paper',
    desc: 'The image stays even after the simulation stops.',
    replace: [
      ['// buffer halaman 32 baris agar muat di RAM Uno', '// a 32-row page buffer so it fits in the Uno’s RAM'],
      ['"Halo e-Paper"', '"Hello e-Paper"'],
      ['"Tinta elektronik: tetap terlihat tanpa daya."', '"Electronic ink: stays visible without power."'],
      [word('layar'), 'display'],
    ],
  },
  'sd-logger': {
    title: 'microSD data logger',
    desc: 'Saves the A0 value to LOG.TXT; the file list appears when the simulation stops.',
    replace: [
      ['"Kartu SD tidak terbaca!"', '"Cannot read the SD card!"'],
      ['"Kartu siap. Geser potensiometer..."', '"Card ready. Slide the potentiometer..."'],
      ['"Tersimpan: "', '"Saved: "'],
      [word('nilai'), 'value'],
    ],
  },
  nlsf595: {
    title: 'RGB LED + NLSF595',
    desc: 'RGB LED colors from a shift register.',
    replace: [
      ['// QB = merah, QC = hijau, QD = biru', '// QB = red, QC = green, QD = blue'],
      [word('tampil'), 'show'],
      [word('pola'), 'pattern'],
      [word('warna'), 'colors'],
    ],
  },
};
