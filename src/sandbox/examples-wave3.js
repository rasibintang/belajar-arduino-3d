// Contoh untuk komponen gelombang 3 (TFT ILI9341, layar sentuh, e-Paper, microSD, NLSF595).

const UNO = { id: 'uno', type: 'arduino-uno', x: -82, z: 22 };
const w = (from, to, color) => ({ from, to, color });
const tftWires = (id) => [
  w('uno:D10', `${id}:CS`, 'orange'),
  w('uno:D9', `${id}:D/C`, 'purple'),
  w('uno:D11', `${id}:MOSI`, 'green'),
  w('uno:D13', `${id}:SCK`, 'yellow'),
  w('uno:D12', `${id}:MISO`, 'blue'),
  w('uno:5V', `${id}:VCC`, 'red'),
  w('uno:GND', `${id}:GND`, 'black'),
];

export const WAVE3_EXAMPLES = [
  {
    id: 'tft',
    title: 'TFT ILI9341 berwarna',
    desc: 'Teks, bentuk, dan pelangi di layar 240×320.',
    diagram: { parts: [UNO, { id: 'tft', type: 'ili9341', x: 40, z: 10 }], wires: tftWires('tft') },
    sketch: `#include <Adafruit_ILI9341.h>

Adafruit_ILI9341 tft(10, 9); // CS, D/C

void setup() {
  tft.begin();
  tft.fillScreen(ILI9341_BLACK);
  // pita pelangi
  for (int i = 0; i < 6; i++) {
    uint16_t warna[] = { ILI9341_RED, ILI9341_ORANGE, ILI9341_YELLOW, ILI9341_GREEN, ILI9341_BLUE, ILI9341_MAGENTA };
    tft.fillRect(0, i * 12, 240, 12, warna[i]);
  }
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(3);
  tft.setCursor(20, 100);
  tft.print("Halo TFT!");
  tft.drawCircle(120, 220, 50, ILI9341_CYAN);
  tft.fillTriangle(120, 180, 80, 250, 160, 250, ILI9341_YELLOW);
}

void loop() {
  tft.setTextSize(2);
  tft.setTextColor(ILI9341_GREEN, ILI9341_BLACK);
  tft.setCursor(20, 290);
  tft.print("Detik: ");
  tft.print(millis() / 1000);
  delay(250);
}
`,
  },
  {
    id: 'tft-touch',
    title: 'Papan gambar sentuh',
    desc: 'Klik dan tahan layar TFT saat simulasi untuk menggambar.',
    diagram: {
      parts: [UNO, { id: 'tft', type: 'ili9341-touch', x: 40, z: 10 }],
      wires: [...tftWires('tft'), w('uno:A4', 'tft:SDA', 'blue'), w('uno:A5', 'tft:SCL', 'yellow')],
    },
    sketch: `#include <Adafruit_ILI9341.h>
#include <Adafruit_FT6206.h>

Adafruit_ILI9341 tft(10, 9);
Adafruit_FT6206 sentuh;

void setup() {
  tft.begin();
  sentuh.begin(40);
  tft.fillScreen(ILI9341_WHITE);
  tft.setTextColor(ILI9341_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 10);
  tft.print("Sentuh layar!");
}

void loop() {
  if (!sentuh.touched()) return;
  TS_Point p = sentuh.getPoint();
  // panel sentuh terpasang terbalik terhadap layar
  int x = map(p.x, 0, 240, 240, 0);
  int y = map(p.y, 0, 320, 320, 0);
  tft.fillCircle(x, y, 6, ILI9341_BLUE);
}
`,
  },
  {
    id: 'epaper',
    title: 'e-Paper 2,9"',
    desc: 'Gambar tetap ada walau simulasi dihentikan.',
    diagram: {
      parts: [UNO, { id: 'ep', type: 'epaper-2in9', x: 50, z: 10 }],
      wires: [
        w('uno:D10', 'ep:CS', 'orange'),
        w('uno:D9', 'ep:DC', 'purple'),
        w('uno:D8', 'ep:RST', 'white'),
        w('uno:D7', 'ep:BUSY', 'blue'),
        w('uno:D11', 'ep:DIN', 'green'),
        w('uno:D13', 'ep:CLK', 'yellow'),
        w('uno:5V', 'ep:VCC', 'red'),
        w('uno:GND', 'ep:GND', 'black'),
      ],
    },
    sketch: `#include <GxEPD2_BW.h>

// buffer halaman 32 baris agar muat di RAM Uno
GxEPD2_BW<GxEPD2_290_T94, 32> layar(GxEPD2_290_T94(10, 9, 8, 7)); // CS, DC, RST, BUSY

void setup() {
  layar.init(0);
  layar.setRotation(1);
  layar.setTextColor(GxEPD_BLACK);
  layar.setFullWindow();
  layar.firstPage();
  do {
    layar.fillScreen(GxEPD_WHITE);
    layar.drawRect(4, 4, 288, 120, GxEPD_BLACK);
    layar.setTextSize(3);
    layar.setCursor(20, 30);
    layar.print("Halo e-Paper");
    layar.setTextSize(1);
    layar.setCursor(20, 80);
    layar.print("Tinta elektronik: tetap terlihat tanpa daya.");
  } while (layar.nextPage());
  layar.hibernate();
}

void loop() {}
`,
  },
  {
    id: 'sd-logger',
    title: 'Pencatat data microSD',
    desc: 'Menyimpan nilai A0 ke LOG.TXT; daftar berkas muncul saat simulasi dihentikan.',
    diagram: {
      parts: [UNO, { id: 'sd', type: 'microsd', x: 40, z: 0 }, { id: 'pot1', type: 'slide-pot', x: 40, z: 60 }],
      wires: [
        w('uno:D4', 'sd:CS', 'orange'),
        w('uno:D11', 'sd:DI', 'green'),
        w('uno:D12', 'sd:DO', 'blue'),
        w('uno:D13', 'sd:SCK', 'yellow'),
        w('uno:5V', 'sd:VCC', 'red'),
        w('uno:GND', 'sd:GND', 'black'),
        w('uno:5V', 'pot1:VCC', 'red'),
        w('uno:GND.1', 'pot1:GND', 'black'),
        w('pot1:SIG', 'uno:A0', 'purple'),
      ],
    },
    sketch: `#include <SD.h>

void setup() {
  Serial.begin(9600);
  if (!SD.begin(4)) {
    Serial.println("Kartu SD tidak terbaca!");
    while (true);
  }
  Serial.println("Kartu siap. Geser potensiometer...");
}

void loop() {
  int nilai = analogRead(A0);
  File log = SD.open("LOG.TXT", FILE_WRITE);
  log.print(millis());
  log.print(",");
  log.println(nilai);
  log.close();
  Serial.print("Tersimpan: ");
  Serial.println(nilai);
  delay(1000);
}
`,
  },
  {
    id: 'nlsf595',
    title: 'LED RGB + NLSF595',
    desc: 'Warna LED RGB dari register geser.',
    diagram: {
      parts: [
        UNO,
        { id: 'bb', type: 'breadboard', x: 44, z: 0 },
        { id: 'sr', type: 'nlsf595', board: 'bb', hole: 'e5' },
        { id: 'rgb1', type: 'rgb-led', board: 'bb', hole: 'c20' },
        { id: 'r1', type: 'resistor', board: 'bb', hole: 'd20', rot: 90, props: { ohms: 220, span: 4 } },
        { id: 'r2', type: 'resistor', board: 'bb', hole: 'd22', rot: 90, props: { ohms: 220, span: 4 } },
        { id: 'r3', type: 'resistor', board: 'bb', hole: 'd23', rot: 90, props: { ohms: 220, span: 4 } },
      ],
      wires: [
        // NLSF595: VCC f5, GND e12, G (aktif LOW) f8, SCLR f11, SI f7, RCK f9, SCK f10
        w('uno:5V', 'bb:j5', 'red'),
        w('uno:GND', 'bb:a12', 'black'),
        w('uno:GND.1', 'bb:j8', 'black'),
        w('uno:5V', 'bb:j11', 'red'),
        w('uno:D2', 'bb:j7', 'green'),
        w('uno:D3', 'bb:j10', 'yellow'),
        w('uno:D4', 'bb:j9', 'orange'),
        // QB (kol. 5) → merah, QC (kol. 6) → hijau, QD (kol. 7) → biru, lewat resistor 220 Ω
        w('bb:b5', 'bb:i20', 'red'),
        w('bb:b6', 'bb:i22', 'green'),
        w('bb:b7', 'bb:i23', 'blue'),
        w('bb:a21', 'uno:GND.2', 'black'),
      ],
    },
    sketch: `const int SI = 2, SCK_ = 3, RCK = 4;

void tampil(byte pola) {
  digitalWrite(RCK, LOW);
  shiftOut(SI, SCK_, MSBFIRST, pola);
  digitalWrite(RCK, HIGH);
}

void setup() {
  pinMode(SI, OUTPUT);
  pinMode(SCK_, OUTPUT);
  pinMode(RCK, OUTPUT);
}

void loop() {
  // QB = merah, QC = hijau, QD = biru
  byte warna[] = { 0b00000010, 0b00000100, 0b00001000, 0b00000110, 0b00001110 };
  for (byte w : warna) {
    tampil(w);
    delay(700);
  }
}
`,
  },
];
