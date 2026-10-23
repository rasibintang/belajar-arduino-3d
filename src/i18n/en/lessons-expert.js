// English translations for the Expert lessons (overlay on the Indonesian source).
// Arrays line up with the source by index; params by key. See src/i18n/lessons.js.
// phrases: text printed by the lesson simulation (Serial, LCD, log) → English.
// marks:   code-highlight markers whose text changed in the English code.
// input:   Serial Monitor commands typed in English → the command the simulation knows.

export default {
  interrupt: {
    title: 'Interrupts',
    heading: 'Interrupts & rotary encoder',
    summary:
      'A rotary encoder sends a pulse every time the knob turns one “click”. The pulse is short — if <code>loop()</code> is busy, it can be missed. An <b>interrupt</b> makes the chip stop whatever it is doing to record the pulse, then carry on.',
    features: ['Drag the encoder knob to turn it', '<code>attachInterrupt()</code> on pin 2', 'Even a slow loop never loses a step'],
    callouts: [
      ['Rotary encoder', 'Drag left/right to turn.'],
      ['Pin 2 · interrupt', 'A CLK pulse triggers onTurn().'],
      ['LCD', 'Shows the position from a volatile variable.'],
    ],
    params: { refresh: { label: 'Loop delay' } },
    explain: [
      '<code>attachInterrupt()</code> ties the <code>onTurn()</code> function to pin 2: every time CLK falls, the function runs immediately.',
      'The direction is read from the DT pin: HIGH means clockwise, LOW counter-clockwise.',
      '<code>volatile</code> tells the compiler that <code>pos</code> can change at any moment outside <code>loop()</code>.',
      'Try a 1500 ms loop delay and turn quickly: the number jumps, but no step is lost.',
    ],
    tip: 'On the Arduino Uno only pins 2 and 3 have external interrupts. Keep interrupt functions as short as possible — no <code>delay()</code> or <code>Serial</code> inside.',
    pinout: ['Encoder CLK (interrupt)', 'Encoder DT (direction)', 'SW (knob button)', 'LCD SDA · SCL'],
    specs: {
      name: 'KY-040 rotary encoder',
      rows: [
        ['Steps per turn', '20'],
        ['Output', '2 quadrature signals (CLK, DT)'],
        ['Button', 'Yes (press the knob)'],
        ['Rotation', 'Endless'],
        ['Uno interrupts', 'Pins 2 and 3'],
      ],
    },
    code: '#include <LiquidCrystal_I2C.h>\n\nLiquidCrystal_I2C lcd(0x27, 16, 2);\nvolatile int pos = 0;\n\nvoid onTurn() {\n  if (digitalRead(3) == HIGH) pos++;\n  else pos--;\n}\n\nvoid setup() {\n  lcd.init();\n  lcd.backlight();\n  pinMode(2, INPUT);\n  pinMode(3, INPUT);\n  attachInterrupt(digitalPinToInterrupt(2), onTurn, FALLING);\n}\n\nvoid loop() {\n  lcd.setCursor(0, 0);\n  lcd.print("Position: ");\n  lcd.print(pos);\n  lcd.print("   ");\n  delay({{refresh}});\n}',
    phrases: [['Posisi: ', 'Position: ']],
  },

  stepper: {
    title: 'Stepper motor',
    heading: 'Stepper motor',
    summary:
      'A stepper motor turns a little at a time: every current pattern in its coils moves the shaft one step. The 28BYJ-48 has 2048 steps per turn — precise enough for clock hands, camera sliders or food dispensers.',
    features: ['<code>motor.step(n)</code> moves exactly n steps', 'LEDs A–D on the driver show the active coil', 'Click the motor for angle and speed'],
    callouts: [
      ['28BYJ-48 stepper', 'Click to set the angle and RPM.'],
      ['ULN2003 driver', 'LEDs A–D = coil sequence.'],
      ['Pins 8–11', 'Four pins, four coils.'],
    ],
    params: { deg: { label: 'Angle per move' }, rpm: { label: 'Speed' } },
    explain: [
      'The <code>Stepper</code> library energizes the coils in turn — the pattern you see on LEDs A–D.',
      '<code>setSpeed(rpm)</code> sets the delay between steps: 10 RPM ≈ 2.9 ms per step.',
      '<code>motor.step(n)</code> waits until n steps are done; a negative number turns the other way.',
      'The pin order 8, 10, 9, 11 (not 8, 9, 10, 11) matches the coil order of the 28BYJ-48.',
    ],
    tip: 'The 28BYJ-48 tops out at ± 15 RPM. Any faster and the motor only buzzes without turning.',
    pinout: ['Driver IN1–IN4', 'Driver + · −', 'Motor cable'],
    specs: {
      name: '28BYJ-48 + ULN2003',
      rows: [
        ['Steps/turn', '2048 (full step)'],
        ['Angle per step', '± 0.18°'],
        ['Voltage', '5 V'],
        ['Torque', '± 300 g·cm'],
        ['Max speed', '± 15 RPM'],
        ['Gearbox', '1 : 64'],
      ],
    },
    code: '#include <Stepper.h>\n\nconst int STEPS = 2048;  // one full turn\nStepper motor(STEPS, 8, 10, 9, 11);\n\nvoid setup() {\n  Serial.begin(9600);\n  motor.setSpeed({{rpm}});\n}\n\nvoid loop() {\n  Serial.println("Forward");\n  motor.step(STEPS * {{deg}} / 360);\n  delay(500);\n  Serial.println("Backward");\n  motor.step(-STEPS * {{deg}} / 360);\n  delay(500);\n}',
    phrases: [
      ['Maju', 'Forward'],
      ['Mundur', 'Backward'],
    ],
  },

  hbridge: {
    title: 'Two-way motor',
    heading: 'L298N H-bridge',
    summary:
      'A single transistor can only run a motor in one direction. An <b>H-bridge</b> uses four switches arranged like the letter H: by swapping which pair is active, the current — and the motor’s rotation — reverses. The L298N holds two H-bridges, enough for two wheels.',
    features: ['IN1/IN2 set the direction', 'ENA/ENB (PWM) set the speed', 'Click the driver to change the movement'],
    callouts: [
      ['L298N', 'Click to choose forward, backward or spin.'],
      ['Motor B', 'Right wheel.'],
      ['Pins 5–10', 'EN (PWM) + two IN pins per motor.'],
      ['Motor A', 'Left wheel.'],
    ],
    params: { move: { label: 'Movement', options: ['Forward', 'Backward', 'Spin'] }, speed: { label: 'Speed' } },
    explain: [
      'The <code>motor()</code> function combines three steps: direction via two IN pins, speed via PWM on the EN pin.',
      'IN1 HIGH + IN2 LOW = forward; IN1 LOW + IN2 HIGH = backward; both LOW = stop.',
      'Giving the two wheels opposite speeds makes the robot spin on the spot.',
    ],
    tip: 'Motors need their own power (a 6–12 V battery on the VIN terminal). Do not forget to connect the battery GND to the Arduino GND!',
    pinout: ['ENA · IN1 · IN2 (motor A)', 'ENB · IN3 · IN4 (motor B)', 'L298N GND (common ground)', 'L298N VIN · GND'],
    specs: {
      name: 'L298N',
      rows: [
        ['Channels', '2 H-bridges'],
        ['Motor voltage', '5–35 V'],
        ['Current per channel', '2 A (3 A peak)'],
        ['Logic', '5 V'],
        ['Voltage drop', '± 2 V (rather wasteful)'],
      ],
    },
  },

  serial: {
    title: 'Serial commands',
    heading: 'Commands over Serial',
    summary:
      'The Serial Monitor is not only for reading — you can also <b>send</b> text to the Arduino. The sketch reads commands line by line and acts on them: type “red”, “blue” or “off” to change the LED color.',
    features: ['Type commands below the Serial Monitor', '<code>Serial.available()</code> + <code>readStringUntil()</code>', 'Unknown commands get a reply'],
    callouts: [
      ['RGB LED', 'Its color is set by text commands.'],
      ['USB = Serial', 'Text from the computer arrives over the USB cable.'],
      ['Pins ~9 ~10 ~11', 'Three colors, three PWM pins.'],
    ],
    explain: [
      '<code>Serial.available()</code> tells how many characters have arrived from the computer; 0 means nothing yet.',
      '<code>readStringUntil(\'\\n\')</code> reads up to the Enter key; <code>trim()</code> removes extra spaces.',
      'An <code>if … else if</code> chain matches the command and calls the <code>color()</code> function.',
      'The sketch always replies, so the user knows whether the command was accepted.',
    ],
    tip: 'Extend it to commands with parameters, e.g. “rgb 255 80 0” — split the text with <code>indexOf(\' \')</code> and <code>toInt()</code>.',
    pinout: ['Resistor → red leg', 'Resistor → green leg', 'Resistor → blue leg', 'Common cathode', 'Serial from the computer (D0/D1)'],
    specs: {
      name: 'Serial (UART)',
      rows: [
        ['Common speeds', '9600 / 115200 baud'],
        ['Pins', 'D0 (RX), D1 (TX)'],
        ['Receive buffer', '64 bytes'],
        ['Line ending', '\\n (newline)'],
        ['Path', 'Through the ATmega16U2 USB chip'],
      ],
    },
    code: 'const int R = 9, G = 10, B = 11;\n\nvoid color(int r, int g, int b) {\n  analogWrite(R, r);\n  analogWrite(G, g);\n  analogWrite(B, b);\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("Type: red, green, blue, yellow, white, off");\n}\n\nvoid loop() {\n  if (!Serial.available()) return;\n  String cmd = Serial.readStringUntil(\'\\n\');\n  cmd.trim();\n\n  bool ok = true;\n  if (cmd == "red") color(255, 0, 0);\n  else if (cmd == "green") color(0, 255, 0);\n  else if (cmd == "blue") color(0, 0, 255);\n  else if (cmd == "yellow") color(255, 180, 0);\n  else if (cmd == "white") color(255, 255, 255);\n  else if (cmd == "off") color(0, 0, 0);\n  else ok = false;\n\n  Serial.println(ok ? "OK: " + cmd : "Unknown: " + cmd);\n}',
    serialInput: ['red', 'green', 'blue', 'yellow', 'white', 'off'],
    input: { red: 'merah', green: 'hijau', blue: 'biru', yellow: 'kuning', white: 'putih', off: 'mati' },
    phrases: [
      ['Ketik: merah, hijau, biru, kuning, putih, mati', 'Type: red, green, blue, yellow, white, off'],
      ['OK: merah', 'OK: red'],
      ['OK: hijau', 'OK: green'],
      ['OK: biru', 'OK: blue'],
      ['OK: kuning', 'OK: yellow'],
      ['OK: putih', 'OK: white'],
      ['OK: mati', 'OK: off'],
      ['Tidak dikenal: ', 'Unknown: '],
    ],
    marks: {
      'Serial.println("Ketik': 'Serial.println("Type',
      'cmd == "merah"': 'cmd == "red"',
      'cmd == "hijau"': 'cmd == "green"',
      'cmd == "biru"': 'cmd == "blue"',
      'cmd == "kuning"': 'cmd == "yellow"',
      'cmd == "putih"': 'cmd == "white"',
      'cmd == "mati"': 'cmd == "off"',
    },
  },

  rtc: {
    title: 'Real-time clock',
    heading: 'DS3231 real-time clock',
    summary:
      '<code>millis()</code> goes back to zero every time the Arduino restarts. The DS3231 RTC module has its own very accurate clock and a coin battery, so it still knows the date and time even when the Arduino is off. Bonus: the chip also has a temperature sensor.',
    features: ['<code>rtc.now()</code> gives hour, minute, second and date', 'One I²C bus for the RTC and the LCD', 'Click the LCD for the clock format and second line'],
    callouts: [
      ['DS3231 RTC', 'A coin battery keeps the clock running.'],
      ['LCD', 'Click to change what it shows.'],
      ['SDA · SCL', 'Two devices, one I²C bus.'],
    ],
    params: { format: { label: 'Clock format', options: ['24 hour', '12 hour'] }, line2: { label: 'Second line', options: ['Date', 'Chip temperature'] } },
    explain: [
      '<code>rtc.now()</code> returns a <code>DateTime</code> object with everything from the year down to the second.',
      'The <code>two()</code> function adds a leading zero to single-digit numbers: 7 → “07”.',
      'In 12-hour format, <code>% 12</code> maps 13–23 to 1–11, and 0 to 12.',
      'The RTC and the LCD share the SDA/SCL wires — every I²C device has its own address (DS3231 = 0x68, LCD = 0x27).',
    ],
    tip: 'Set the RTC clock once with <code>rtc.adjust(DateTime(F(__DATE__), F(__TIME__)))</code>, then remove that line and upload again.',
    pinout: ['RTC (I²C bus)', 'LCD (same I²C bus)', 'RTC VCC · GND', 'LCD VCC · GND'],
    specs: {
      name: 'DS3231',
      rows: [
        ['Accuracy', '± 2 ppm (± 1 minute/year)'],
        ['Battery', 'CR2032, lasts for years'],
        ['I²C address', '0x68'],
        ['Temperature sensor', '± 3 °C'],
        ['Alarms', '2 programmable alarms'],
      ],
    },
    code: '#include <RTClib.h>\n#include <LiquidCrystal_I2C.h>\n\nRTC_DS3231 rtc;\nLiquidCrystal_I2C lcd(0x27, 16, 2);\n\nString two(int n) { return n < 10 ? "0" + String(n) : String(n); }\n\nvoid setup() {\n  rtc.begin();\n  lcd.init();\n  lcd.backlight();\n}\n\nvoid loop() {\n  DateTime now = rtc.now();\n  lcd.setCursor(0, 0);\n{{format.line}}\n  lcd.setCursor(0, 1);\n{{line2.line}}\n  delay(1000);\n}',
    optionCode: {
      'format.24': { line: '  lcd.print(two(now.hour()) + ":" + two(now.minute()) + ":" + two(now.second()));' },
      'format.12': { line: '  int h = now.hour() % 12;\n  if (h == 0) h = 12;\n  lcd.print(two(h) + ":" + two(now.minute()) + (now.hour() < 12 ? " AM" : " PM"));' },
      'line2.date': { line: '  lcd.print(two(now.day()) + "/" + two(now.month()) + "/" + String(now.year()));' },
      'line2.temp': { line: '  lcd.print("Temp: " + String(rtc.getTemperature()) + " C");' },
    },
    phrases: [['Suhu: ', 'Temp: ']],
    marks: { 'lcd.print(dua(': 'lcd.print(two(' },
  },

  eeprom: {
    title: 'Save data',
    heading: 'Save data in EEPROM',
    summary:
      'Ordinary variables are lost when the Arduino is switched off or reset. The ATmega328P has 1024 bytes of <b>EEPROM</b> that keeps its contents without power. Here we count how many times the button is pressed — and the number survives a reset.',
    features: ['<code>EEPROM.read()</code> / <code>EEPROM.write()</code>', 'Press the button to add to the count', 'Click the red RESET button on the board: the number stays!'],
    callouts: [
      ['Push button', 'Every press is saved to EEPROM.'],
      ['RESET button', 'Click to restart the sketch.'],
      ['EEPROM', 'Inside the ATmega328P — 1 KB that never forgets.'],
      ['LED', 'Blinks when data is written.'],
    ],
    params: { wipe: { label: 'EEPROM contents', options: ['Keep', 'Erase'] } },
    explain: [
      '<code>EEPROM.read(0)</code> reads the byte at address 0 — the value left over from before.',
      'On every press, <code>count</code> goes up and is immediately written back with <code>EEPROM.write(0, count)</code>.',
      'A byte only holds 0–255; after 255 it wraps back to 0. For bigger numbers use <code>EEPROM.put()</code>.',
    ],
    tip: 'Each EEPROM cell survives ± 100,000 writes. Do not write on every loop — only when the value changes.',
    pinout: ['One side of the button', 'Button + 10 kΩ pull-down', 'Resistor → LED', 'Pull-down and LED'],
    specs: {
      name: 'ATmega328P EEPROM',
      rows: [
        ['Size', '1024 bytes'],
        ['Addresses', '0–1023'],
        ['Endurance', '± 100,000 writes/cell'],
        ['Write time', '± 3.3 ms per byte'],
        ['Initial contents', '255 (0xFF)'],
      ],
    },
    code: '#include <EEPROM.h>\n\nconst int BUTTON = 2;\nconst int LED = 13;\nbyte count;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(BUTTON, INPUT);\n  pinMode(LED, OUTPUT);\n  count = EEPROM.read(0);\n  Serial.print("Saved: ");\n  Serial.println(count);\n}\n\nvoid loop() {\n  if (digitalRead(BUTTON) == HIGH) {\n    count++;\n    EEPROM.write(0, count);\n    Serial.println(count);\n    digitalWrite(LED, HIGH);\n    delay(300);\n    digitalWrite(LED, LOW);\n  }\n}',
    phrases: [['Tersimpan: ', 'Saved: ']],
    marks: { 'Serial.print("Tersimpan': 'Serial.print("Saved' },
  },

  neopixel: {
    title: 'NeoPixel LEDs',
    heading: 'NeoPixel ring',
    summary:
      'Every NeoPixel LED has a tiny chip inside. The color data is passed along a chain over <b>one</b> wire: the first LED takes its color and forwards the rest to the next LED. Twelve RGB LEDs, just one pin.',
    features: ['<code>setPixelColor(i, color)</code> per LED', 'One data pin for every LED', 'Click the ring for animation, color and brightness'],
    callouts: [
      ['NeoPixel ring', 'Click to change the animation.'],
      ['Pin 6 → DIN', 'Color data for all 12 LEDs.'],
      ['5V · GND', 'Each LED can draw up to 60 mA.'],
    ],
    params: { anim: { label: 'Animation', options: ['Rainbow', 'Chase', 'Breathe'] }, color: { label: 'Color', options: ['Red', 'Teal', 'Purple', 'Amber'] }, bright: { label: 'Brightness' } },
    explain: [
      '<code>Adafruit_NeoPixel ring(12, 6, …)</code>: 12 LEDs on pin 6, GRB color order.',
      '<code>setPixelColor()</code> only changes memory; the new colors appear after <code>ring.show()</code>.',
      '<code>ColorHSV()</code> picks a color by hue (0–65535) — an easy way to make a rainbow.',
      '<code>step</code> goes up every loop so the pattern shifts and appears to move.',
    ],
    tip: '12 LEDs at full white can draw ± 720 mA — too much for USB. Limit the brightness or use a separate 5 V supply.',
    pinout: ['Ring DIN', 'Ring 5V', 'Ring GND'],
    specs: {
      name: 'NeoPixel ring (WS2812B)',
      rows: [
        ['LED count', '12'],
        ['Color', '24 bit (16.7 million)'],
        ['Protocol', '1 wire, 800 kHz'],
        ['Current per LED', 'up to 60 mA'],
        ['Voltage', '5 V'],
      ],
    },
  },

  state: {
    title: 'State machine',
    heading: 'State machine: crossing',
    summary:
      'Bigger programs easily get tangled in nested <code>if</code>s. A <b>state machine</b> splits them into a few clear states — GREEN, YELLOW, RED, BACK — and rules for when to move from one state to another. Our example is a pedestrian crossing.',
    features: ['<code>enum</code> + <code>switch</code> for each state', 'Press the crossing button in the 3D view', 'Switch states with <code>millis()</code>, no delay'],
    callouts: [
      ['Traffic light', 'Green → yellow → red.'],
      ['Crossing button', 'Click to request a crossing.'],
      ['Pedestrian light', 'Green when it is safe to cross.'],
      ['Buzzer', 'Beeps while crossing is allowed.'],
    ],
    params: { walkTime: { label: 'Crossing time' } },
    explain: [
      '<code>enum State</code> gives each state a name — much clearer than the numbers 0, 1, 2, 3.',
      '<code>switch (state)</code> only runs the code that belongs to the current state.',
      'The <code>enter()</code> function switches state and records the time, so each state knows how long it has been running.',
      'Without <code>delay()</code>, the button can be read at any moment.',
    ],
    tip: 'Draw the state diagram on paper first (circles = states, arrows = conditions to move). The code then simply copies the diagram.',
    pinout: ['Green · yellow · red light', 'Crossing button + pull-down', 'Pedestrian red · green LED', 'Buzzer', 'Breadboard − rail'],
    specs: {
      name: 'States',
      rows: [
        ['GREEN', 'Cars drive, wait for the button'],
        ['YELLOW', '2 seconds, then RED'],
        ['RED', 'Pedestrians cross'],
        ['BACK', '1.5 second safety pause'],
      ],
    },
    code: 'enum State { GREEN, YELLOW, RED, BACK };\nState state = GREEN;\nunsigned long since = 0;\n\nvoid enter(State s) {\n  state = s;\n  since = millis();\n}\n\nvoid cars(int pin) {\n  for (int p = 2; p <= 4; p++) digitalWrite(p, p == pin);\n}\n\nvoid setup() {\n  for (int p = 2; p <= 4; p++) pinMode(p, OUTPUT);\n  pinMode(7, INPUT);\n  pinMode(11, OUTPUT);\n  pinMode(12, OUTPUT);\n}\n\nvoid loop() {\n  unsigned long t = millis() - since;\n  switch (state) {\n    case GREEN:\n      cars(2);\n      digitalWrite(12, HIGH);\n      if (digitalRead(7) == HIGH) enter(YELLOW);\n      break;\n    case YELLOW:\n      cars(3);\n      if (t > 2000) enter(RED);\n      break;\n    case RED:\n      cars(4);\n      digitalWrite(12, LOW);\n      digitalWrite(11, HIGH);\n      tone(8, 1200, 40);\n      if (t > {{walkTime}}) enter(BACK);\n      break;\n    case BACK:\n      digitalWrite(11, LOW);\n      digitalWrite(12, HIGH);\n      if (t > 1500) enter(GREEN);\n      break;\n  }\n}',
    marks: { 'case HIJAU': 'case GREEN', 'case KUNING': 'case YELLOW', 'case MERAH': 'case RED', 'case KEMBALI': 'case BACK' },
    phrases: [
      ['state: HIJAU', 'state: GREEN'],
      ['state: KUNING', 'state: YELLOW'],
      ['state: MERAH', 'state: RED'],
      ['state: KEMBALI', 'state: BACK'],
    ],
  },

  robot: {
    title: 'Project: robot',
    heading: 'Project: obstacle-avoiding robot',
    summary:
      'The final project: a two-wheeled robot that explores on its own. The distance sensor at the front keeps measuring; while the way is clear the robot drives forward, and when it gets too close it stops, backs up, then turns to find another way. Everything from the Expert level comes together here.',
    features: ['Press Run and watch the robot explore the arena', 'Decisions from the sensor distance (Basic lesson 7)', 'Two-wheel drive through the L298N (Expert 3)'],
    callouts: [
      ['Distance sensor', 'Click to set the safe distance.'],
      ['L298N', 'Click for speed and turn time.'],
      ['Robot brain', 'Measure → decide → move, over and over.'],
      ['Obstacles', 'The robot has to avoid them.'],
    ],
    params: { limit: { label: 'Safe distance' }, speed: { label: 'Speed' }, turn: { label: 'Turn time' } },
    explain: [
      'The <code>drive(left, right)</code> function wraps all the H-bridge work: the sign sets the direction, the size sets the speed.',
      '<code>distanceCm()</code> reuses the distance measurement from Basic lesson 7.',
      'If the way is clear, both wheels go forward. If it is too close: stop, back up, then the left wheel goes forward and the right backward — the robot spins.',
      'Real robots never behave exactly the same: try changing the safe distance and turn time, then watch how it behaves.',
    ],
    tip: 'Robot stuck in a corner? Pick the turning direction at random with <code>random(2)</code>, or add a servo so the sensor can “look” left and right.',
    pinout: ['ENA · IN1 · IN2 (left wheel)', 'ENB · IN3 · IN4 (right wheel)', 'Sensor Trig · Echo', '5V from the L298N (Arduino power)', 'L298N VIN · GND'],
    specs: {
      name: 'Obstacle-avoiding robot',
      rows: [
        ['Drive', '2 TT motors + caster wheel'],
        ['Driver', 'L298N'],
        ['Sensor', 'HC-SR04 (2–400 cm)'],
        ['Power', '4 × AA (6 V)'],
        ['Speed', '± 17 cm/second'],
        ['Wheel base', '128 mm'],
      ],
    },
    code: 'const int ENA = 5, IN1 = 7, IN2 = 8;\nconst int ENB = 6, IN3 = 9, IN4 = 10;\nconst int TRIG = 2, ECHO = 3;\n\nvoid drive(int left, int right) {\n  digitalWrite(IN1, left > 0);  digitalWrite(IN2, left < 0);\n  digitalWrite(IN3, right > 0); digitalWrite(IN4, right < 0);\n  analogWrite(ENA, abs(left));\n  analogWrite(ENB, abs(right));\n}\n\nlong distanceCm() {\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  return pulseIn(ECHO, HIGH) / 58;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  for (int p = 5; p <= 10; p++) pinMode(p, OUTPUT);\n  pinMode(TRIG, OUTPUT);\n  pinMode(ECHO, INPUT);\n}\n\nvoid loop() {\n  long cm = distanceCm();\n  if (cm > {{limit}}) {\n    drive({{speed}}, {{speed}});        // forward\n  } else {\n    drive(0, 0);                        // stop\n    delay(200);\n    drive(-150, -150);                  // back up a little\n    delay(400);\n    drive({{speed}}, -{{speed}});       // spin to the right\n    delay({{turn}});\n  }\n  delay(50);\n}',
  },
};
