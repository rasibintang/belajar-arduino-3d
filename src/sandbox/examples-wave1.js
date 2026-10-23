// Contoh untuk komponen tambahan (gerbang logika, LCD paralel, A4988, NeoPixel matrix, PIR).

const UNO = { id: 'uno', type: 'arduino-uno', x: -82, z: 22 };
const BB = { id: 'bb', type: 'breadboard', x: 44, z: 0 };
const w = (from, to, color) => ({ from, to, color });

export const WAVE1_EXAMPLES = [
  {
    id: 'logic',
    title: 'Tabel kebenaran',
    desc: 'Arduino memberi A dan B ke gerbang AND & XOR lalu membaca hasilnya.',
    diagram: {
      parts: [UNO, { id: 'and1', type: 'gate-and', x: 20, z: -10 }, { id: 'xor1', type: 'gate-xor', x: 20, z: 40 }],
      wires: [
        w('uno:D2', 'and1:A', 'blue'),
        w('uno:D3', 'and1:B', 'yellow'),
        w('uno:D2', 'xor1:A', 'blue'),
        w('uno:D3', 'xor1:B', 'yellow'),
        w('and1:Y', 'uno:D4', 'green'),
        w('xor1:Y', 'uno:D5', 'orange'),
      ],
    },
    sketch: `// Gerbang logika ideal: tidak perlu catu daya.
void setup() {
  Serial.begin(9600);
  pinMode(2, OUTPUT);
  pinMode(3, OUTPUT);
  Serial.println("A B | AND XOR");
}

void loop() {
  for (int i = 0; i < 4; i++) {
    int a = i & 1;
    int b = i >> 1;
    digitalWrite(2, a);
    digitalWrite(3, b);
    Serial.print(a);
    Serial.print(" ");
    Serial.print(b);
    Serial.print(" |  ");
    Serial.print(digitalRead(4));
    Serial.print("   ");
    Serial.println(digitalRead(5));
    delay(1000);
  }
}
`,
  },
  {
    id: 'lcd-parallel',
    title: 'LCD 16×2 paralel',
    desc: 'Library LiquidCrystal dalam mode 4 bit.',
    diagram: {
      parts: [UNO, { id: 'lcd1', type: 'lcd-16x2', x: 40, z: 10 }],
      wires: [
        w('uno:D12', 'lcd1:RS', 'orange'),
        w('uno:D11', 'lcd1:E', 'yellow'),
        w('uno:D5', 'lcd1:D4', 'green'),
        w('uno:D4', 'lcd1:D5', 'green'),
        w('uno:D3', 'lcd1:D6', 'green'),
        w('uno:D2', 'lcd1:D7', 'green'),
        w('uno:5V', 'lcd1:VDD', 'red'),
        w('uno:GND', 'lcd1:VSS', 'black'),
        w('uno:GND.1', 'lcd1:RW', 'black'),
      ],
    },
    sketch: `#include <LiquidCrystal.h>

// RS, E, D4, D5, D6, D7
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  lcd.begin(16, 2);
  lcd.print("Halo, Arduino!");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Detik: ");
  lcd.print(millis() / 1000);
}
`,
  },
  {
    id: 'a4988',
    title: 'Stepper NEMA 17 + A4988',
    desc: 'Satu pulsa STEP = 1,8°. Bolak-balik satu putaran.',
    diagram: {
      parts: [UNO, BB, { id: 'drv', type: 'a4988', board: 'bb', hole: 'e12' }, { id: 'm1', type: 'stepper-bipolar', x: 70, z: -70 }],
      wires: [
        w('uno:D3', 'bb:a18', 'orange'),
        w('uno:D4', 'bb:a19', 'yellow'),
        w('bb:a16', 'bb:a17', 'blue'),
        w('uno:5V', 'bb:j18', 'red'),
        w('uno:GND', 'bb:j19', 'black'),
        w('bb:j14', 'm1:B-', 'green'),
        w('bb:j15', 'm1:B+', 'green'),
        w('bb:j16', 'm1:A+', 'blue'),
        w('bb:j17', 'm1:A-', 'blue'),
        w('uno:5V', 'bb:a16', 'red'),
      ],
    },
    sketch: `const int STEP = 3;
const int DIR = 4;

void putar(int langkah, bool searah) {
  digitalWrite(DIR, searah ? HIGH : LOW);
  for (int i = 0; i < langkah; i++) {
    digitalWrite(STEP, HIGH);
    delayMicroseconds(2000);
    digitalWrite(STEP, LOW);
    delayMicroseconds(2000);
  }
}

void setup() {
  pinMode(STEP, OUTPUT);
  pinMode(DIR, OUTPUT);
}

void loop() {
  putar(200, true);   // satu putaran penuh
  delay(500);
  putar(200, false);
  delay(500);
}
`,
  },
  {
    id: 'neopixel-matrix',
    title: 'NeoPixel matrix 8×8',
    desc: 'Titik pelangi berjalan di 64 LED.',
    diagram: {
      parts: [UNO, { id: 'mx', type: 'neopixel-matrix', x: 50, z: 20 }],
      wires: [w('uno:D6', 'mx:DIN', 'green'), w('uno:5V', 'mx:VDD', 'red'), w('uno:GND', 'mx:GND', 'black')],
    },
    sketch: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel m(64, 6, NEO_GRB + NEO_KHZ800);
int pos = 0;

void setup() {
  m.begin();
  m.setBrightness(80);
}

void loop() {
  m.clear();
  for (int k = 0; k < 6; k++) {
    int i = (pos + k) % 64;
    m.setPixelColor(i, m.ColorHSV((pos * 1024 + k * 4000) % 65536));
  }
  m.show();
  pos = (pos + 1) % 64;
  delay(60);
}
`,
  },
  {
    id: 'pir',
    title: 'Alarm gerak PIR',
    desc: 'Klik sensor PIR saat simulasi untuk “bergerak” di depannya.',
    diagram: {
      parts: [UNO, { id: 'pir1', type: 'pir-sensor', x: 30, z: 20 }],
      wires: [w('uno:5V', 'pir1:VCC', 'red'), w('uno:GND', 'pir1:GND', 'black'), w('pir1:OUT', 'uno:D2', 'yellow')],
    },
    sketch: `const int PIR = 2;
bool tadi = false;

void setup() {
  Serial.begin(9600);
  pinMode(PIR, INPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("Menunggu gerakan...");
}

void loop() {
  bool ada = digitalRead(PIR);
  digitalWrite(LED_BUILTIN, ada);
  if (ada && !tadi) Serial.println("Ada gerakan!");
  if (!ada && tadi) Serial.println("Sepi lagi.");
  tadi = ada;
}
`,
  },
];
