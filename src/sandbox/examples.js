// Proyek contoh untuk sandbox. Komponen breadboard memakai `hole`: pin pertamanya
// ditancapkan ke lubang itu (rot 180 = kaki menghadap ke kiri).
import { MORE_EXAMPLES } from './examples-more.js';
import { WAVE1_EXAMPLES } from './examples-wave1.js';

const UNO = { id: 'uno', type: 'arduino-uno', x: -82, z: 22 };
const BB = { id: 'bb', type: 'breadboard', x: 44, z: 0 };

export const EXAMPLES = [
  {
    id: 'blink',
    title: 'Blink (LED bawaan)',
    desc: 'LED “L” di papan berkedip tiap detik.',
    diagram: { parts: [{ ...UNO, x: -34, z: 27 }], wires: [] },
    sketch: `// LED "L" di papan tersambung ke pin 13
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`,
  },
  {
    id: 'led',
    title: 'LED + resistor',
    desc: 'Rangkaian pertama di breadboard.',
    diagram: {
      parts: [
        UNO,
        BB,
        { id: 'r1', type: 'resistor', board: 'bb', hole: 'd8', props: { ohms: 220, span: 4 } },
        { id: 'led1', type: 'led', board: 'bb', hole: 'b13', rot: 180, props: { color: 'red' } },
      ],
      wires: [
        { from: 'uno:D13', to: 'bb:c8', color: 'orange' },
        { from: 'uno:GND.1', to: 'bb:a13', color: 'black' },
      ],
    },
    sketch: `const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
}
`,
  },
  {
    id: 'button',
    title: 'Tombol & LED',
    desc: 'Tahan tombol (klik di 3D) untuk menyalakan LED.',
    diagram: {
      parts: [
        UNO,
        BB,
        { id: 'btn1', type: 'push-button', board: 'bb', hole: 'f19' },
        { id: 'r2', type: 'resistor', board: 'bb', hole: 'c21', props: { ohms: 10000, span: 4 } },
        { id: 'r1', type: 'resistor', board: 'bb', hole: 'd5', props: { ohms: 220, span: 4 } },
        { id: 'led1', type: 'led', board: 'bb', hole: 'b10', rot: 180, props: { color: 'green' } },
      ],
      wires: [
        { from: 'uno:5V', to: 'bb:j19', color: 'red' },
        { from: 'uno:D2', to: 'bb:a21', color: 'blue' },
        { from: 'uno:GND', to: 'bb:a25', color: 'black' },
        { from: 'uno:D13', to: 'bb:c5', color: 'orange' },
        { from: 'uno:GND.1', to: 'bb:a10', color: 'black' },
      ],
    },
    sketch: `const int BUTTON = 2;
const int LED = 13;

void setup() {
  Serial.begin(9600);
  pinMode(BUTTON, INPUT);
  pinMode(LED, OUTPUT);
}

int last = LOW;

void loop() {
  int now = digitalRead(BUTTON);
  digitalWrite(LED, now);
  if (now != last) {
    Serial.println(now == HIGH ? "Ditekan" : "Dilepas");
    last = now;
  }
}
`,
  },
  {
    id: 'pot',
    title: 'Potensiometer → LED redup',
    desc: 'analogRead() dan analogWrite(). Seret kenopnya saat berjalan.',
    diagram: {
      parts: [
        UNO,
        BB,
        { id: 'pot1', type: 'potentiometer', board: 'bb', hole: 'c17', props: { value: 600 } },
        { id: 'r1', type: 'resistor', board: 'bb', hole: 'd5', props: { ohms: 220, span: 4 } },
        { id: 'led1', type: 'led', board: 'bb', hole: 'b10', rot: 180, props: { color: 'yellow' } },
      ],
      wires: [
        { from: 'uno:5V', to: 'bb:a17', color: 'red' },
        { from: 'uno:A0', to: 'bb:a18', color: 'green' },
        { from: 'uno:GND', to: 'bb:a19', color: 'black' },
        { from: 'uno:D9', to: 'bb:c5', color: 'orange' },
        { from: 'uno:GND.1', to: 'bb:a10', color: 'black' },
      ],
    },
    sketch: `void setup() {
  Serial.begin(9600);
  pinMode(9, OUTPUT);
}

void loop() {
  int value = analogRead(A0);
  analogWrite(9, value / 4);
  Serial.println(value);
  delay(100);
}
`,
  },
  {
    id: 'servo',
    title: 'Servo menyapu',
    desc: 'Library Servo: 0° → 180° dan kembali.',
    diagram: {
      parts: [UNO, { id: 'servo1', type: 'servo-sg90', x: 40, z: 6, rot: 180 }],
      wires: [
        { from: 'uno:GND', to: 'servo1:GND', color: 'brown' },
        { from: 'uno:5V', to: 'servo1:V+', color: 'red' },
        { from: 'uno:D9', to: 'servo1:SIG', color: 'orange' },
      ],
    },
    sketch: `#include <Servo.h>

Servo arm;

void setup() {
  arm.attach(9);
}

void loop() {
  for (int a = 0; a <= 180; a++) {
    arm.write(a);
    delay(10);
  }
  for (int a = 180; a >= 0; a--) {
    arm.write(a);
    delay(10);
  }
}
`,
  },
  {
    id: 'buzzer',
    title: 'Melodi buzzer',
    desc: 'tone() memainkan tangga nada.',
    diagram: {
      parts: [UNO, BB, { id: 'bz1', type: 'buzzer', board: 'bb', hole: 'c15' }],
      wires: [
        { from: 'uno:D8', to: 'bb:a18', color: 'orange' },
        { from: 'uno:GND', to: 'bb:a15', color: 'black' },
      ],
    },
    sketch: `int melody[] = {262, 294, 330, 349, 392, 440, 494, 523};

void setup() {}

void loop() {
  for (int i = 0; i < 8; i++) {
    tone(8, melody[i], 250);
    delay(300);
  }
  delay(1000);
}
`,
  },
  {
    id: 'lcd',
    title: 'LCD “Halo, dunia!”',
    desc: 'LiquidCrystal_I2C lewat A4/A5.',
    diagram: {
      parts: [UNO, { id: 'lcd1', type: 'lcd-i2c', x: 42, z: -2 }],
      wires: [
        { from: 'uno:GND', to: 'lcd1:GND', color: 'black' },
        { from: 'uno:5V', to: 'lcd1:VCC', color: 'red' },
        { from: 'uno:A4', to: 'lcd1:SDA', color: 'blue' },
        { from: 'uno:A5', to: 'lcd1:SCL', color: 'yellow' },
      ],
    },
    sketch: `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Halo, dunia!");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Detik: ");
  lcd.print(millis() / 1000);
  delay(1000);
}
`,
  },
  {
    id: 'sonar',
    title: 'Sensor jarak HC-SR04',
    desc: 'pulseIn() mengukur gema. Klik sensor untuk mengubah jarak.',
    diagram: {
      parts: [UNO, BB, { id: 'sonar1', type: 'hc-sr04', board: 'bb', hole: 'a14', props: { distance: 42 } }],
      wires: [
        { from: 'uno:5V', to: 'bb:c14', color: 'red' },
        { from: 'uno:D9', to: 'bb:c15', color: 'purple' },
        { from: 'uno:D10', to: 'bb:c16', color: 'blue' },
        { from: 'uno:GND', to: 'bb:c17', color: 'black' },
      ],
    },
    sketch: `const int TRIG = 9;
const int ECHO = 10;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long cm = pulseIn(ECHO, HIGH) / 58;
  Serial.print("Jarak: ");
  Serial.print(cm);
  Serial.println(" cm");
  delay(500);
}
`,
  },
];

EXAMPLES.push(...MORE_EXAMPLES, ...WAVE1_EXAMPLES);

/** Proyek kosong: hanya Arduino Uno. */
export const BLANK = {
  title: 'Proyek baru',
  diagram: { parts: [{ ...UNO, x: -34, z: 27 }], wires: [] },
  sketch: `void setup() {
  // dijalankan sekali saat mulai
  Serial.begin(9600);
}

void loop() {
  // diulang terus-menerus
}
`,
};
