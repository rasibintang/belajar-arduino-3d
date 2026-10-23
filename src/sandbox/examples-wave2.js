// Contoh untuk komponen gelombang 2 (OLED, TM1637, MAX7219, DS18B20, IR, RFID, MPU6050).

const UNO = { id: 'uno', type: 'arduino-uno', x: -82, z: 22 };
const w = (from, to, color) => ({ from, to, color });
const i2c = (id) => [w('uno:A4', `${id}:SDA`, 'blue'), w('uno:A5', `${id}:SCL`, 'yellow'), w('uno:5V', `${id}:VCC`, 'red'), w('uno:GND', `${id}:GND`, 'black')];

export const WAVE2_EXAMPLES = [
  {
    id: 'oled',
    title: 'OLED SSD1306',
    desc: 'Teks dan grafik di layar 128×64 lewat I²C.',
    diagram: { parts: [UNO, { id: 'oled1', type: 'oled-ssd1306', x: 30, z: 10 }], wires: i2c('oled1') },
    sketch: `#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 layar(128, 64, &Wire, -1);

void setup() {
  layar.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  layar.setTextColor(SSD1306_WHITE);
}

void loop() {
  layar.clearDisplay();
  layar.setTextSize(2);
  layar.setCursor(0, 0);
  layar.print("Halo!");
  layar.setTextSize(1);
  layar.setCursor(0, 24);
  layar.print("Detik: ");
  layar.print(millis() / 1000);
  // batang yang memanjang tiap detik
  layar.drawRect(0, 44, 128, 12, SSD1306_WHITE);
  layar.fillRect(2, 46, (millis() / 1000 % 10) * 12.4, 8, SSD1306_WHITE);
  layar.display();
  delay(200);
}
`,
  },
  {
    id: 'tm1637',
    title: 'Jam TM1637',
    desc: 'Menit:detik sejak menyala, titik dua berkedip.',
    diagram: {
      parts: [UNO, { id: 'disp', type: 'tm1637', x: 30, z: 10 }],
      wires: [w('uno:D2', 'disp:CLK', 'yellow'), w('uno:D3', 'disp:DIO', 'blue'), w('uno:5V', 'disp:VCC', 'red'), w('uno:GND', 'disp:GND', 'black')],
    },
    sketch: `#include <TM1637Display.h>

TM1637Display layar(2, 3); // CLK, DIO

void setup() {
  layar.setBrightness(5);
}

void loop() {
  unsigned long s = millis() / 1000;
  int mmss = (s / 60) * 100 + s % 60;
  bool titik = (millis() / 500) % 2;
  layar.showNumberDecEx(mmss, titik ? 0b01000000 : 0, true);
  delay(100);
}
`,
  },
  {
    id: 'max7219',
    title: 'Teks berjalan MAX7219',
    desc: 'Empat matriks 8×8 + MD_Parola.',
    diagram: {
      parts: [UNO, { id: 'mx', type: 'max7219-matrix', x: 50, z: 10, props: { count: 4 } }],
      wires: [w('uno:D11', 'mx:DIN', 'green'), w('uno:D13', 'mx:CLK', 'yellow'), w('uno:D10', 'mx:CS', 'orange'), w('uno:5V', 'mx:VCC', 'red'), w('uno:GND', 'mx:GND', 'black')],
    },
    sketch: `#include <MD_Parola.h>
#include <MD_MAX72xx.h>
#include <SPI.h>

MD_Parola layar(MD_MAX72XX::FC16_HW, 10, 4); // CS = 10, 4 modul

void setup() {
  layar.begin();
  layar.setIntensity(4);
  layar.displayText("Halo Arduino!", PA_CENTER, 60, 1000, PA_SCROLL_LEFT, PA_SCROLL_LEFT);
}

void loop() {
  if (layar.displayAnimate()) layar.displayReset();
}
`,
  },
  {
    id: 'ds18b20',
    title: 'Termometer DS18B20',
    desc: 'OneWire + DallasTemperature. Ubah suhu di panel komponen.',
    diagram: {
      parts: [UNO, { id: 'bb', type: 'breadboard-mini', x: 30, z: 10 }, { id: 't1', type: 'ds18b20', board: 'bb', hole: 'c8' }],
      wires: [w('uno:GND', 'bb:a8', 'black'), w('uno:D2', 'bb:a9', 'yellow'), w('uno:5V', 'bb:a10', 'red')],
    },
    sketch: `#include <OneWire.h>
#include <DallasTemperature.h>

OneWire kabel(2);
DallasTemperature sensor(&kabel);

void setup() {
  Serial.begin(9600);
  sensor.begin();
}

void loop() {
  sensor.requestTemperatures();
  Serial.print("Suhu: ");
  Serial.print(sensor.getTempCByIndex(0));
  Serial.println(" °C");
  delay(1000);
}
`,
  },
  {
    id: 'ir',
    title: 'Remote IR',
    desc: 'Klik tombol remote saat simulasi; kodenya muncul di Serial Monitor.',
    diagram: {
      parts: [UNO, { id: 'ir1', type: 'ir-receiver', x: 20, z: 10 }, { id: 'rm', type: 'ir-remote', x: 80, z: 10 }],
      wires: [w('ir1:DAT', 'uno:D2', 'yellow'), w('uno:5V', 'ir1:VCC', 'red'), w('uno:GND', 'ir1:GND', 'black')],
    },
    sketch: `#include <IRremote.hpp>

void setup() {
  Serial.begin(9600);
  IrReceiver.begin(2);
  Serial.println("Tekan tombol remote...");
}

void loop() {
  if (IrReceiver.decode()) {
    int kode = IrReceiver.decodedIRData.command;
    Serial.print("Kode: ");
    Serial.print(kode);
    if (kode == 162) Serial.print("  (POWER)");
    if (kode == 168) Serial.print("  (PLAY)");
    Serial.println();
    IrReceiver.resume();
  }
}
`,
  },
  {
    id: 'rfid',
    title: 'Pembaca RFID',
    desc: 'Klik modul RFID saat simulasi untuk menempelkan kartu.',
    diagram: {
      parts: [UNO, { id: 'rf', type: 'rfid-mfrc522', x: 40, z: 0 }],
      wires: [
        w('uno:D10', 'rf:SDA', 'orange'),
        w('uno:D13', 'rf:SCK', 'yellow'),
        w('uno:D11', 'rf:MOSI', 'green'),
        w('uno:D12', 'rf:MISO', 'blue'),
        w('uno:D9', 'rf:RST', 'white'),
        w('uno:3V3', 'rf:3.3V', 'red'),
        w('uno:GND', 'rf:GND', 'black'),
      ],
    },
    sketch: `#include <SPI.h>
#include <MFRC522.h>

MFRC522 rfid(10, 9); // SS, RST

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Tempelkan kartu...");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  Serial.print("UID:");
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(rfid.uid.uidByte[i], HEX);
  }
  Serial.println();
  rfid.PICC_HaltA();
}
`,
  },
  {
    id: 'mpu6050',
    title: 'Kemiringan MPU6050',
    desc: 'Ubah percepatan di panel komponen dan lihat sudutnya.',
    diagram: { parts: [UNO, { id: 'imu', type: 'mpu6050', x: 30, z: 10, props: { ax: 0.5, az: 0.87 } }], wires: i2c('imu') },
    sketch: `#include <Adafruit_MPU6050.h>

Adafruit_MPU6050 mpu;

void setup() {
  Serial.begin(9600);
  if (!mpu.begin()) {
    Serial.println("MPU6050 tidak ditemukan!");
    while (true);
  }
}

void loop() {
  sensors_event_t a, g, t;
  mpu.getEvent(&a, &g, &t);
  float miring = atan2(a.acceleration.x, a.acceleration.z) * 180 / PI;
  Serial.print("Miring: ");
  Serial.print(miring, 1);
  Serial.println(" derajat");
  delay(500);
}
`,
  },
];
