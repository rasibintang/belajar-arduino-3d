// Contoh tambahan untuk komponen Menengah/Mahir.

const UNO = { id: 'uno', type: 'arduino-uno', x: -82, z: 22 };
const BB = { id: 'bb', type: 'breadboard', x: 44, z: 0 };
const w = (from, to, color) => ({ from, to, color });

export const MORE_EXAMPLES = [
  {
    id: 'rgb',
    title: 'LED RGB pelangi',
    desc: 'analogWrite() di tiga pin PWM.',
    diagram: {
      parts: [
        UNO,
        BB,
        { id: 'rgb1', type: 'rgb-led', board: 'bb', hole: 'c13' },
        { id: 'r1', type: 'resistor', board: 'bb', hole: 'd13', rot: 90, props: { ohms: 220, span: 4 } },
        { id: 'r2', type: 'resistor', board: 'bb', hole: 'd15', rot: 90, props: { ohms: 220, span: 4 } },
        { id: 'r3', type: 'resistor', board: 'bb', hole: 'd16', rot: 90, props: { ohms: 220, span: 4 } },
      ],
      wires: [w('uno:D9', 'bb:h13', 'red'), w('uno:D10', 'bb:i15', 'green'), w('uno:D11', 'bb:j16', 'blue'), w('uno:GND', 'bb:a14', 'black')],
    },
    sketch: `void color(int r, int g, int b) {
  analogWrite(9, r);
  analogWrite(10, g);
  analogWrite(11, b);
}

void setup() {}

void loop() {
  color(255, 0, 0);   delay(700);
  color(0, 255, 0);   delay(700);
  color(0, 0, 255);   delay(700);
  color(170, 0, 255); delay(700);
  color(255, 160, 0); delay(700);
}
`,
  },
  {
    id: 'ldr',
    title: 'Lampu malam (LDR)',
    desc: 'Klik LDR untuk mengubah cahaya.',
    diagram: {
      parts: [
        UNO,
        BB,
        { id: 'ldr1', type: 'ldr', board: 'bb', hole: 'c20', props: { lux: 300 } },
        { id: 'r2', type: 'resistor', board: 'bb', hole: 'd21', props: { ohms: 10000, span: 4 } },
        { id: 'r1', type: 'resistor', board: 'bb', hole: 'd5', props: { ohms: 220, span: 4 } },
        { id: 'led1', type: 'led', board: 'bb', hole: 'b10', rot: 180, props: { color: 'yellow' } },
      ],
      wires: [w('uno:5V', 'bb:a20', 'red'), w('uno:A0', 'bb:b21', 'green'), w('uno:GND', 'bb:a25', 'black'), w('uno:D9', 'bb:c5', 'orange'), w('uno:GND.1', 'bb:a10', 'black')],
    },
    sketch: `const int DARK = 400;

void setup() {
  Serial.begin(9600);
  pinMode(9, OUTPUT);
}

void loop() {
  int light = analogRead(A0);
  Serial.println(light);
  digitalWrite(9, light < DARK);
  delay(300);
}
`,
  },
  {
    id: 'seg7',
    title: 'Hitung 0–9 (7-segment)',
    desc: 'Array pola segmen; satu resistor di katoda.',
    diagram: {
      parts: [UNO, BB, { id: 'seg1', type: 'seg7', board: 'bb', hole: 'e14' }, { id: 'r1', type: 'resistor', board: 'bb', hole: 'b16', props: { ohms: 330, span: 4 } }],
      wires: [
        w('uno:D2', 'bb:j17', 'red'),
        w('uno:D3', 'bb:j18', 'orange'),
        w('uno:D4', 'bb:a17', 'yellow'),
        w('uno:D5', 'bb:a15', 'green'),
        w('uno:D6', 'bb:a14', 'blue'),
        w('uno:D7', 'bb:j15', 'purple'),
        w('uno:D8', 'bb:j14', 'white'),
        w('uno:D9', 'bb:a18', 'brown'),
        w('uno:GND', 'bb:a20', 'black'),
      ],
    },
    sketch: `// Segmen A..G di pin 2..8
const byte DIGITS[10] = {
  0b0111111, 0b0000110, 0b1011011, 0b1001111, 0b1100110,
  0b1101101, 0b1111101, 0b0000111, 0b1111111, 0b1101111
};

void setup() {
  for (int p = 2; p <= 9; p++) pinMode(p, OUTPUT);
}

void show(int n) {
  for (int s = 0; s < 7; s++)
    digitalWrite(2 + s, bitRead(DIGITS[n], s));
}

void loop() {
  for (int n = 0; n < 10; n++) {
    show(n);
    delay(600);
  }
}
`,
  },
  {
    id: 'hc595',
    title: 'Shift register 74HC595',
    desc: '8 LED dari 3 pin dengan shiftOut().',
    diagram: {
      parts: [UNO, BB, { id: 'sr1', type: 'hc595', board: 'bb', hole: 'e10' }, { id: 'bar1', type: 'led-bar', board: 'bb', hole: 'h20', props: { color: 'green' } }],
      wires: [
        w('uno:5V', 'bb:tp3', 'red'),
        w('uno:GND', 'bb:tn4', 'black'),
        w('uno:GND.1', 'bb:bn3', 'black'),
        w('bb:tp9', 'bb:j10', 'red'),
        w('bb:tp15', 'bb:j16', 'red'),
        w('bb:tn12', 'bb:j13', 'black'),
        w('bb:bn17', 'bb:a17', 'black'),
        w('bb:tn21', 'bb:j20', 'black'),
        w('uno:D11', 'bb:j12', 'blue'),
        w('uno:D12', 'bb:j14', 'purple'),
        w('uno:D13', 'bb:j15', 'yellow'),
        w('bb:i11', 'bb:j21', 'green'),
        w('bb:a10', 'bb:i22', 'green'),
        w('bb:a11', 'bb:i23', 'green'),
        w('bb:a12', 'bb:i24', 'green'),
        w('bb:a13', 'bb:i25', 'green'),
        w('bb:a14', 'bb:i26', 'green'),
        w('bb:a15', 'bb:i27', 'green'),
        w('bb:a16', 'bb:i28', 'green'),
      ],
    },
    sketch: `const int DATA = 11, LATCH = 12, CLOCK = 13;
byte leds = 0;

void setup() {
  pinMode(DATA, OUTPUT);
  pinMode(LATCH, OUTPUT);
  pinMode(CLOCK, OUTPUT);
}

void loop() {
  leds++;
  digitalWrite(LATCH, LOW);
  shiftOut(DATA, CLOCK, LSBFIRST, leds);
  digitalWrite(LATCH, HIGH);
  delay(250);
}
`,
  },
  {
    id: 'motor',
    title: 'Motor DC + transistor',
    desc: 'PWM lewat transistor TIP120.',
    diagram: {
      parts: [
        UNO,
        BB,
        { id: 'q1', type: 'npn-tip120', board: 'bb', hole: 'c20' },
        { id: 'r1', type: 'resistor', board: 'bb', hole: 'b16', props: { ohms: 1000, span: 4 } },
        { id: 'm1', type: 'dc-motor', x: 70, z: 72 },
      ],
      wires: [w('uno:D6', 'bb:a16', 'orange'), w('uno:GND', 'bb:a22', 'black'), w('uno:5V', 'm1:+', 'red'), w('m1:-', 'bb:a21', 'black')],
    },
    sketch: `void setup() {
  pinMode(6, OUTPUT);
}

void loop() {
  for (int s = 0; s <= 255; s += 5) {
    analogWrite(6, s);
    delay(40);
  }
  delay(1500);
  analogWrite(6, 0);
  delay(1500);
}
`,
  },
  {
    id: 'neopixel',
    title: 'NeoPixel pelangi',
    desc: 'Library Adafruit NeoPixel, satu pin data.',
    diagram: {
      parts: [UNO, { id: 'ring1', type: 'neopixel-ring', x: 30, z: 8 }],
      wires: [w('uno:D6', 'ring1:DIN', 'green'), w('uno:5V', 'ring1:5V', 'red'), w('uno:GND', 'ring1:GND', 'black')],
    },
    sketch: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel ring(12, 6, NEO_GRB + NEO_KHZ800);
long hue = 0;

void setup() {
  ring.begin();
  ring.setBrightness(120);
}

void loop() {
  for (int i = 0; i < 12; i++)
    ring.setPixelColor(i, ring.ColorHSV(hue + i * 5461));
  ring.show();
  hue += 1024;
  delay(40);
}
`,
  },
  {
    id: 'dht',
    title: 'Suhu & kelembapan (DHT11)',
    desc: 'Klik sensor untuk mengubah cuaca.',
    diagram: {
      parts: [UNO, BB, { id: 'dht1', type: 'dht11', board: 'bb', hole: 'c14', props: { temp: 29, hum: 65 } }],
      wires: [w('uno:5V', 'bb:a14', 'red'), w('uno:D2', 'bb:a15', 'green'), w('uno:GND', 'bb:a16', 'black')],
    },
    sketch: `#include <DHT.h>

DHT dht(2, DHT11);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  delay(2000);
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  Serial.print("Suhu: ");
  Serial.print(t);
  Serial.print(" C  Lembap: ");
  Serial.print(h);
  Serial.println(" %");
}
`,
  },
  {
    id: 'rtc',
    title: 'Jam RTC + LCD',
    desc: 'RTClib dan LCD berbagi bus I²C.',
    diagram: {
      parts: [UNO, { id: 'lcd1', type: 'lcd-i2c', x: 42, z: -6 }, { id: 'rtc1', type: 'rtc-ds3231', x: -12, z: 68 }],
      wires: [
        w('uno:GND', 'lcd1:GND', 'black'),
        w('uno:5V', 'lcd1:VCC', 'red'),
        w('uno:A4', 'lcd1:SDA', 'blue'),
        w('uno:A5', 'lcd1:SCL', 'yellow'),
        w('uno:GND.2', 'rtc1:GND', 'black'),
        w('uno:3V3', 'rtc1:VCC', 'red'),
        w('uno:SDA', 'rtc1:SDA', 'blue'),
        w('uno:SCL', 'rtc1:SCL', 'yellow'),
      ],
    },
    sketch: `#include <RTClib.h>
#include <LiquidCrystal_I2C.h>

RTC_DS3231 rtc;
LiquidCrystal_I2C lcd(0x27, 16, 2);

void dua(int n) {
  if (n < 10) lcd.print('0');
  lcd.print(n);
}

void setup() {
  rtc.begin();
  lcd.init();
  lcd.backlight();
}

void loop() {
  DateTime now = rtc.now();
  lcd.setCursor(0, 0);
  dua(now.hour()); lcd.print(':');
  dua(now.minute()); lcd.print(':');
  dua(now.second());
  lcd.setCursor(0, 1);
  dua(now.day()); lcd.print('/');
  dua(now.month()); lcd.print('/');
  lcd.print(now.year());
  delay(500);
}
`,
  },
  {
    id: 'stepper',
    title: 'Motor stepper',
    desc: 'Library Stepper: setengah putaran bolak-balik.',
    diagram: {
      parts: [UNO, { id: 'st1', type: 'stepper-28byj48', x: 14, z: 40 }],
      wires: [
        w('uno:D8', 'st1:IN1', 'blue'),
        w('uno:D9', 'st1:IN2', 'green'),
        w('uno:D10', 'st1:IN3', 'yellow'),
        w('uno:D11', 'st1:IN4', 'orange'),
        w('uno:5V', 'st1:+', 'red'),
        w('uno:GND', 'st1:-', 'black'),
      ],
    },
    sketch: `#include <Stepper.h>

Stepper motor(2048, 8, 10, 9, 11);

void setup() {
  motor.setSpeed(12);
}

void loop() {
  motor.step(1024);
  delay(500);
  motor.step(-1024);
  delay(500);
}
`,
  },
  {
    id: 'keypad',
    title: 'Keypad 4×4',
    desc: 'Klik tombolnya; karakter muncul di Serial.',
    diagram: {
      parts: [UNO, { id: 'kp1', type: 'keypad-4x4', x: -40, z: 128 }],
      wires: ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'].map((pin, i) =>
        w(`uno:D${9 - i}`, `kp1:${pin}`, ['brown', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white'][i])
      ),
    },
    sketch: `#include <Keypad.h>

char keys[4][4] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rows[4] = {9, 8, 7, 6};
byte cols[4] = {5, 4, 3, 2};
Keypad pad = Keypad(makeKeymap(keys), rows, cols, 4, 4);

void setup() {
  Serial.begin(9600);
}

void loop() {
  char key = pad.getKey();
  if (key) Serial.println(key);
}
`,
  },
  {
    id: 'joystick',
    title: 'Joystick → Serial',
    desc: 'Seret tuasnya saat simulasi berjalan.',
    diagram: {
      parts: [UNO, { id: 'joy1', type: 'joystick', x: -30, z: 70 }],
      wires: [
        w('uno:GND.2', 'joy1:GND', 'black'),
        w('uno:5V', 'joy1:+5V', 'red'),
        w('uno:A0', 'joy1:VRx', 'green'),
        w('uno:A1', 'joy1:VRy', 'blue'),
        w('uno:D2', 'joy1:SW', 'purple'),
      ],
    },
    sketch: `void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  Serial.print("X=");
  Serial.print(analogRead(A0));
  Serial.print("  Y=");
  Serial.print(analogRead(A1));
  Serial.println(digitalRead(2) == LOW ? "  [KLIK]" : "");
  delay(200);
}
`,
  },
  {
    id: 'encoder',
    title: 'Rotary encoder + interrupt',
    desc: 'Seret kenopnya; posisi dihitung oleh interrupt.',
    diagram: {
      parts: [UNO, { id: 'enc1', type: 'rotary-encoder', x: -10, z: 70 }],
      wires: [w('uno:D2', 'enc1:CLK', 'green'), w('uno:D3', 'enc1:DT', 'purple'), w('uno:5V', 'enc1:+', 'red'), w('uno:GND.2', 'enc1:GND', 'black')],
    },
    sketch: `volatile int pos = 0;
int shown = 0;

void onTurn() {
  if (digitalRead(3) == HIGH) pos++;
  else pos--;
}

void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT);
  pinMode(3, INPUT);
  attachInterrupt(digitalPinToInterrupt(2), onTurn, FALLING);
  Serial.println("Putar kenopnya!");
}

void loop() {
  if (pos != shown) {
    shown = pos;
    Serial.print("Posisi: ");
    Serial.println(shown);
  }
}
`,
  },
  {
    id: 'relay',
    title: 'Relay berkedip',
    desc: 'Dengar bunyi klik relay.',
    diagram: {
      parts: [UNO, { id: 'rl1', type: 'relay-module', x: -2, z: 60 }],
      wires: [w('uno:D7', 'rl1:S', 'orange'), w('uno:5V', 'rl1:+', 'red'), w('uno:GND', 'rl1:-', 'black')],
    },
    sketch: `void setup() {
  pinMode(7, OUTPUT);
}

void loop() {
  digitalWrite(7, HIGH);
  delay(1000);
  digitalWrite(7, LOW);
  delay(1000);
}
`,
  },
];
