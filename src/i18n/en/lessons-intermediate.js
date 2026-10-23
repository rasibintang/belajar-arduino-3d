// English translations for the Intermediate lessons (overlay on the Indonesian source).
// Arrays line up with the source by index; params by key. See src/i18n/lessons.js.
// phrases: text printed by the lesson simulation (Serial, LCD, log) → English.
// marks:   code-highlight markers whose text changed in the English code.

const COLORS = ['Red', 'Yellow', 'Green', 'Blue', 'White'];

export default {
  millis: {
    title: 'Without delay()',
    heading: 'Without delay()',
    summary:
      '<code>delay()</code> makes the Arduino sit and wait — during that time it cannot do anything else. With <code>millis()</code> the sketch just glances at the clock and decides: two LEDs blink at different tempos without waiting for each other.',
    features: ['<code>millis()</code>: milliseconds since power-up', 'Two LEDs, two tempos, one loop', 'The “is it time yet?” pattern'],
    callouts: [
      ['millis()', 'The chip’s internal clock, counting up every millisecond.'],
      ['LED A · pin 13', 'Blinks at tempo A.'],
      ['No waiting', 'The loop runs thousands of times per second.'],
      ['LED B · pin 12', 'Blinks at tempo B.'],
    ],
    params: { tA: { label: 'Tempo A' }, tB: { label: 'Tempo B' } },
    explain: [
      '<code>millis()</code> returns the number of milliseconds since the board powered up; it keeps counting up.',
      'Each LED remembers when it last changed (<code>lastA</code>, <code>lastB</code>).',
      'Once the difference reaches the tempo, the LED is flipped and the time is recorded again.',
      'There is no <code>delay()</code>, so the loop is always ready — for example to read a button at the same time.',
    ],
    tip: 'Use <code>unsigned long</code> for time: an <code>int</code> only reaches 32,767 ms (± 33 seconds) before it overflows.',
    pinout: ['Resistor → LED A (red)', 'Resistor → LED B (green)', 'Short legs of both LEDs'],
    specs: {
      name: 'Arduino time functions',
      rows: [
        ['millis()', 'Milliseconds since power-up'],
        ['Overflows after', '± 49.7 days'],
        ['micros()', 'Microseconds, 4 µs resolution'],
        ['delay(ms)', 'Blocks the program'],
        ['Data type', 'unsigned long (32 bit)'],
      ],
    },
  },

  debounce: {
    title: 'Debounce',
    heading: 'Debounce a button',
    summary:
      'The metal contacts inside a button bounce a few times within milliseconds. The Arduino is fast enough to see every bounce — one press can be counted three or four times. Debouncing waits until the reading settles.',
    features: ['Press the button and watch the count', 'Compare “no debounce” and “debounced”', 'Set the debounce wait time'],
    callouts: [
      ['Push button', 'Click and release — count how many times it registers.'],
      ['LED', 'Toggles every time the count goes up.'],
      ['Pin 2', 'Reads HIGH/LOW thousands of times per second.'],
      ['Wait time', 'The reading must be stable for this many ms.'],
    ],
    params: { mode: { label: 'Reading method', options: ['No debounce', 'Debounced'] }, wait: { label: 'Wait time' } },
    explain: [
      'Every time the button is pressed or released, its contacts chatter for ± 5–20 ms before settling.',
      '<b>No debounce</b> mode counts every LOW→HIGH change — bounces included.',
      '<b>Debounced</b> mode records when the reading last changed and only trusts it after it has been stable for the wait time.',
    ],
    tip: 'Click the button a few times in “no debounce” mode: the count often jumps by 2–4 at once. Those are the bounces!',
    pinout: ['One side of the button', 'Other side of the button + 10 kΩ pull-down', 'Resistor → LED', 'Pull-down and LED'],
    specs: {
      name: 'Contact bounce',
      rows: [
        ['Bounce duration', '± 1–20 ms'],
        ['Number of bounces', '2–10'],
        ['Loop speed', '> 100,000 times/second'],
        ['Typical wait time', '20–50 ms'],
        ['Alternative', '100 nF capacitor (hardware)'],
      ],
    },
  },

  lcd: {
    title: 'LCD screen',
    heading: '16×2 LCD screen',
    summary:
      'A 16×2 LCD shows two lines of text, 16 characters each. The I²C module on its back means you only need four wires: two for power, two for data (SDA and SCL).',
    features: ['<code>lcd.print()</code> writes text', 'I²C: only pins A4 (SDA) and A5 (SCL)', 'The second line counts seconds'],
    callouts: [
      ['16×2 LCD', 'Click to change the message or backlight.'],
      ['A4 · A5', 'SDA (data) and SCL (clock) of the I²C bus.'],
      ['5V & GND', 'Power for the screen and its backlight.'],
    ],
    params: {
      msg: { label: 'Line 1 message', options: ['Hello, world!', 'Learning Arduino', 'Good morning :)'], values: ['Hello, world!', 'Learning Arduino', 'Good morning :)'] },
      backlight: { label: 'Backlight', options: ['On', 'Off'] },
    },
    explain: [
      '<code>LiquidCrystal_I2C lcd(0x27, 16, 2)</code> sets up a screen at I²C address 0x27, 16 columns × 2 rows.',
      '<code>lcd.setCursor(column, row)</code> moves the cursor; counting starts at 0.',
      '<code>lcd.print()</code> writes text or numbers starting at the cursor.',
      'The first line is written once in <code>setup()</code>; the second is updated every second in <code>loop()</code>.',
    ],
    tip: 'Blank screen? Turn the small potentiometer on the back of the I²C module to adjust the contrast. The address can also be 0x3F.',
    pinout: ['I²C module GND', 'I²C module VCC', 'SDA (data)', 'SCL (clock)'],
    specs: {
      name: 'LCD 1602 + I²C',
      rows: [
        ['Display', '16 × 2 characters'],
        ['Character size', '5 × 8 dots'],
        ['Interface', 'I²C (PCF8574)'],
        ['Address', '0x27 or 0x3F'],
        ['Voltage', '5 V'],
        ['Backlight', 'LED, can be switched off'],
      ],
    },
    code: '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\n\nLiquidCrystal_I2C lcd(0x27, 16, 2);\n\nvoid setup() {\n  lcd.init();\n  lcd.{{backlight.call}}();\n  lcd.setCursor(0, 0);\n  lcd.print("{{msg}}");\n}\n\nvoid loop() {\n  lcd.setCursor(0, 1);\n  lcd.print("Seconds: ");\n  lcd.print(millis() / 1000);\n  delay(1000);\n}',
    phrases: [
      ['Detik: ', 'Seconds: '],
      ['Halo, dunia!', 'Hello, world!'],
    ],
  },

  dht: {
    title: 'Temp & humidity',
    heading: 'Temperature & humidity',
    summary:
      'The DHT11 measures air temperature and humidity, then sends the result as a train of bits over a single data wire. The DHT library turns it into ready-to-use numbers.',
    features: ['<code>readTemperature()</code> and <code>readHumidity()</code>', 'Click the sensor to change the room weather', 'Results in the Serial Monitor every 2 seconds'],
    callouts: [
      ['DHT11', 'Click to change temperature and humidity.'],
      ['Pin 2', 'A single two-way data wire.'],
      ['5V & GND', 'Power for the sensor.'],
    ],
    params: { temp: { label: 'Room temperature' }, hum: { label: 'Humidity' } },
    explain: [
      '<code>DHT dht(2, DHT11)</code> tells the library there is a DHT11 sensor on pin 2.',
      '<code>readTemperature()</code> gives the temperature in °C; <code>readHumidity()</code> the relative humidity in %.',
      'A <code>float</code> stores numbers with decimals, like 27.00.',
      'The DHT11 is slow: wait at least 1–2 seconds between readings.',
    ],
    tip: 'If the result is <code>nan</code> (not a number), the sensor could not be read — check the data wire and the delay.',
    pinout: ['Sensor VCC', 'DATA', 'Sensor GND'],
    specs: {
      name: 'DHT11',
      rows: [
        ['Temperature', '0–50 °C (± 2 °C)'],
        ['Humidity', '20–90 % (± 5 %)'],
        ['Resolution', '1 °C / 1 %'],
        ['Minimum interval', '1 second'],
        ['Voltage', '3.3–5 V'],
        ['Interface', '1 wire (custom protocol)'],
      ],
    },
    code: '#include <DHT.h>\n\nDHT dht(2, DHT11);\n\nvoid setup() {\n  Serial.begin(9600);\n  dht.begin();\n}\n\nvoid loop() {\n  float t = dht.readTemperature();\n  float h = dht.readHumidity();\n\n  Serial.print("Temp: ");\n  Serial.print(t);\n  Serial.print(" C  Humidity: ");\n  Serial.print(h);\n  Serial.println(" %");\n  delay(2000);\n}',
    phrases: [
      ['Suhu: ', 'Temp: '],
      [' C  Lembap: ', ' C  Humidity: '],
    ],
  },

  arrays: {
    title: 'Functions & arrays',
    heading: 'Functions & arrays',
    summary:
      'Eight LEDs means eight pins. Instead of writing eight similar lines, keep the pin numbers in an <b>array</b> and repeat with <code>for</code>. Wrap the display logic in a <b>function</b> to keep the loop tidy.',
    features: ['The <code>LEDS[]</code> array holds 8 pin numbers', 'The <code>show(pos)</code> function is called repeatedly', 'Click the LED module for pattern and speed'],
    callouts: [
      ['8-LED module', 'Click to change the pattern.'],
      ['Pins 2–9', 'Eight consecutive pins — perfect for an array.'],
      ['GND', 'One ground for all LEDs.'],
    ],
    params: { pattern: { label: 'Pattern', options: ['Running', 'Bounce', 'Fill'] }, speed: { label: 'Delay' }, color: { label: 'Color', options: COLORS } },
    explain: [
      '<code>LEDS[]</code> stores 8 pin numbers; <code>LEDS[0]</code> is 2, <code>LEDS[7]</code> is 9.',
      'The <code>for</code> loop in <code>setup()</code> configures all eight pins at once.',
      'The <code>show(pos)</code> function lights the LEDs for a position — called from <code>loop()</code> with different values.',
      'Changing the pattern only means changing the function body or the order of the calls.',
    ],
    tip: 'In the “fill” pattern, <code>i &lt;= pos</code> lights every LED up to that position — like a battery level meter.',
    pinout: ['LED 1', 'LED 2', 'LED 3', 'LED 4', 'LED 5', 'LED 6', 'LED 7', 'LED 8', 'Module GND'],
    specs: {
      name: 'Arrays in Arduino',
      rows: [
        ['First index', '0'],
        ['Last index', 'N − 1'],
        ['Size', 'Fixed, set when created'],
        ['Element count', 'sizeof(arr) / sizeof(arr[0])'],
        ['Bounds', 'An index outside the size = bug!'],
      ],
    },
  },

  shift: {
    title: 'Shift register',
    heading: '74HC595 shift register',
    summary:
      'Out of pins? The 74HC595 chip takes in 8 bits one at a time over a single data wire, then outputs them all at once on 8 outputs. Only 3 Arduino pins for 8 LEDs — and the chips can be chained for 16, 24 or more.',
    features: ['<code>shiftOut()</code> sends 8 bits', '3 pins: DATA, CLOCK, LATCH', 'Click the chip to change the bit pattern'],
    callouts: [
      ['74HC595', 'Click to change the pattern.'],
      ['8 outputs', 'Q0–Q7 light up according to the bits.'],
      ['Pins 11 · 12 · 13', 'DATA, LATCH, CLOCK.'],
    ],
    params: { pattern: { label: 'Pattern', options: ['Binary count', 'Shift', 'Random'] }, speed: { label: 'Delay' } },
    explain: [
      '<code>byte leds</code> stores 8 bits — one bit per LED.',
      '<code>LATCH</code> LOW holds the old outputs while the new bits are sent.',
      '<code>shiftOut()</code> sends 8 bits over DATA, one bit per CLOCK tick.',
      '<code>LATCH</code> HIGH copies all eight bits to the outputs at once — the LEDs change together.',
    ],
    tip: 'Connect pin Q7′ to the DATA of a second chip and send 2 bytes: 16 LEDs, still 3 pins.',
    pinout: ['DS (DATA, chip pin 14)', 'ST_CP (LATCH, chip pin 12)', 'SH_CP (CLOCK, chip pin 11)', 'Chip VCC', 'Chip & LED module GND'],
    specs: {
      name: '74HC595',
      rows: [
        ['Type', 'Serial-in, parallel-out'],
        ['Outputs', '8 (Q0–Q7)'],
        ['Voltage', '2–6 V'],
        ['Current per pin', '± 6 mA (max 35 mA)'],
        ['Speed', '> 25 MHz'],
        ['Package', 'DIP-16'],
      ],
    },
  },

  keypad: {
    title: 'Keypad & lock',
    heading: 'Keypad & combination lock',
    summary:
      'A 4×4 keypad arranges 16 keys in 4 rows and 4 columns, so 8 pins are enough. The Keypad library scans row by row to find which key is pressed. We use it for a combination lock: type the code, then press #.',
    features: ['Click the keypad keys in the 3D view', 'Collect characters in a <code>String</code>', 'Green = unlocked, red = wrong'],
    callouts: [
      ['4×4 keypad', 'Type the code, then press #. The * key clears.'],
      ['Pins 2–9', '4 rows + 4 columns = 8 wires.'],
      ['Green LED', 'Lights up when the code is right.'],
      ['Red LED', 'Lights up when the code is wrong.'],
    ],
    params: { password: { label: 'Code' } },
    explain: [
      'The <code>keys</code> array maps each row/column position to the character printed on the key.',
      '<code>pad.getKey()</code> scans the keypad and returns a character — or 0 if nothing is pressed.',
      'Characters are collected in <code>input</code>; <b>#</b> checks, <b>*</b> clears.',
      'The comparison <code>input == "1234"</code> decides which LED lights up.',
    ],
    tip: 'On a real device, never print the code to Serial — and limit the number of attempts so it cannot be guessed forever.',
    pinout: ['Row 1', 'Row 2', 'Row 3', 'Row 4', 'Column 1', 'Column 2', 'Column 3', 'Column 4', 'Green LED · red LED'],
    specs: {
      name: '4×4 membrane keypad',
      rows: [
        ['Keys', '16 (0–9, A–D, *, #)'],
        ['Pins', '8 (4 rows + 4 columns)'],
        ['Thickness', '± 0.8 mm'],
        ['Lifetime', '± 1 million presses'],
        ['Library', 'Keypad (Mark Stanley)'],
      ],
    },
    code:
      "#include <Keypad.h>\n\nchar keys[4][4] = {\n  {'1','2','3','A'},\n  {'4','5','6','B'},\n  {'7','8','9','C'},\n  {'*','0','#','D'}\n};\nbyte rows[4] = {9, 8, 7, 6};\nbyte cols[4] = {5, 4, 3, 2};\nKeypad pad = Keypad(makeKeymap(keys), rows, cols, 4, 4);\nString input = \"\";\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(12, OUTPUT);  // green\n  pinMode(11, OUTPUT);  // red\n}\n\nvoid loop() {\n  char key = pad.getKey();\n  if (!key) return;\n  Serial.println(key);\n\n  if (key == '#') {\n    bool ok = (input == \"{{password}}\");\n    digitalWrite(12, ok);\n    digitalWrite(11, !ok);\n    Serial.println(ok ? \"Unlocked!\" : \"Wrong\");\n    input = \"\";\n  } else if (key == '*') {\n    input = \"\";\n  } else {\n    input += key;\n  }\n}",
    phrases: [
      ['Terbuka!', 'Unlocked!'],
      ['Salah', 'Wrong'],
    ],
  },

  joystick: {
    title: 'Joystick',
    heading: 'Joystick',
    summary:
      'A joystick holds two potentiometers — one for the X axis, one for Y — and a button that clicks when you press the stick. <code>map()</code> turns the 0–1023 reading into a 0–180° servo angle.',
    features: ['Drag the joystick stick in the 3D view', 'Two <code>analogRead()</code>s: A0 and A1', '<code>map()</code> rescales to 0–180°'],
    callouts: [
      ['Joystick', 'Drag the stick; click to press the button.'],
      ['A0 · A1', 'X and Y position, 0–1023 each.'],
      ['Servo', 'Follows one joystick axis.'],
    ],
    params: { axis: { label: 'Servo follows', options: ['X axis', 'Y axis'] } },
    explain: [
      'In the center position both axes read about 512.',
      '<code>map(value, 0, 1023, 0, 180)</code> converts the reading range into an angle range.',
      '<code>INPUT_PULLUP</code> enables the internal resistor: button released = HIGH, pressed = LOW.',
    ],
    tip: 'Joysticks are rarely exactly 512 in the middle. Ignore readings of 490–530 (a “dead zone”) so the servo does not jitter.',
    pinout: ['Joystick +5V · GND', 'VRx (X axis)', 'VRy (Y axis)', 'SW (button)', 'Servo signal'],
    specs: {
      name: 'KY-023 joystick module',
      rows: [
        ['Axes', '2 × 10 kΩ potentiometers'],
        ['Reading', '0–1023 per axis'],
        ['Center position', '± 512'],
        ['Button', 'Active LOW (use a pull-up)'],
        ['Voltage', '3.3–5 V'],
      ],
    },
    code: '#include <Servo.h>\n\nServo arm;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(2, INPUT_PULLUP);\n  arm.attach(9);\n}\n\nvoid loop() {\n  int x = analogRead(A0);\n  int y = analogRead(A1);\n  int angle = map({{axis}}, 0, 1023, 0, 180);\n  arm.write(angle);\n\n  if (digitalRead(2) == LOW) Serial.println("Click!");\n  Serial.print(x);\n  Serial.print(", ");\n  Serial.println(y);\n  delay(100);\n}',
    phrases: [['Klik!', 'Click!']],
  },

  relay: {
    title: 'Relay & lamp',
    heading: 'Relay & lamp',
    summary:
      'An Arduino pin can only manage 5 V and a few milliamps. A relay is a mechanical switch moved by an electromagnet: a small signal from the Arduino opens or closes contacts for much bigger household power.',
    features: ['Hear the “click” as the contacts switch', 'The AC bulb lights through the NO contact', 'Click the relay to set the schedule'],
    callouts: [
      ['Relay module', 'Click to set the on/off times.'],
      ['Bulb', 'Connected through COM and NO.'],
      ['Pin 7', 'HIGH = coil energized, contacts close.'],
      ['AC power', 'Danger! Only simulated here.'],
    ],
    params: { on: { label: 'On time' }, off: { label: 'Off time' } },
    explain: [
      'Pin 7 HIGH sends current through the relay coil; its magnetic field pulls the contacts so <b>COM</b> connects to <b>NO</b>.',
      'The bulb sits in an AC circuit <i>separate</i> from the Arduino — only the relay contacts connect it.',
      'Pin LOW releases the coil; a spring returns the contacts to <b>NC</b> and the bulb goes out.',
    ],
    tip: '⚠ Mains electricity (110–230 V) is dangerous. For practice, use a 12 V LED lamp or ask an adult who knows electrics for help.',
    pinout: ['S (relay signal)', 'Relay +', 'Relay −', 'Interrupts the live wire to the bulb'],
    specs: {
      name: 'SRD-05VDC-SL-C relay',
      rows: [
        ['Coil voltage', '5 V DC'],
        ['Coil current', '± 70 mA'],
        ['Max load', '10 A @ 250 V AC'],
        ['Contacts', 'COM, NO, NC'],
        ['Response time', '± 10 ms'],
        ['Protection', 'Diode + optocoupler on the module'],
      ],
    },
    code: 'const int RELAY = 7;\n\nvoid setup() {\n  pinMode(RELAY, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(RELAY, HIGH);   // lamp on\n  delay({{on}});\n  digitalWrite(RELAY, LOW);    // lamp off\n  delay({{off}});\n}',
  },

  thermostat: {
    title: 'Project: thermostat',
    heading: 'Project: fan thermostat',
    summary:
      'Put it all together: a DHT11 measures the temperature, an LCD shows it, and a relay switches a fan on when the room gets too hot. The fan cools the room, the temperature drops, and the fan switches off again — a real control system.',
    features: ['Sensor → decision → action', 'Status shown on the screen', 'A relay switches the fan'],
    callouts: [
      ['DHT11', 'Click to change the room temperature.'],
      ['LCD', 'Temperature and fan status.'],
      ['Relay', 'Click to change the temperature limit.'],
      ['Fan', 'Slowly cools the room.'],
    ],
    params: { temp: { label: 'Room temperature' }, limit: { label: 'Fan on above' } },
    explain: [
      'Every second the sketch reads the temperature and compares it with <code>LIMIT</code>.',
      'The result of the comparison (<code>true</code>/<code>false</code>) is written straight to the relay pin.',
      'The fan lowers the temperature; once it is below the limit, the relay switches it off — then the temperature rises again. This is <b>feedback control</b>.',
    ],
    tip: 'A fan that switches on and off too often wears out quickly. Add <b>hysteresis</b>: on above 28 °C, off below 27 °C.',
    pinout: ['DHT11 DATA', 'I²C LCD', 'Relay signal', 'Breadboard power rails', 'Fan power wire'],
    specs: {
      name: 'Thermostat system',
      rows: [
        ['Sensor', 'DHT11 (± 2 °C)'],
        ['Display', '16×2 I²C LCD'],
        ['Actuator', '10 A relay + fan'],
        ['Cycle', '1 second'],
        ['Control type', 'On/off (bang-bang)'],
      ],
    },
    code: '#include <DHT.h>\n#include <LiquidCrystal_I2C.h>\n\nDHT dht(2, DHT11);\nLiquidCrystal_I2C lcd(0x27, 16, 2);\nconst int RELAY = 7;\nconst float LIMIT = {{limit}};\n\nvoid setup() {\n  dht.begin();\n  lcd.init();\n  lcd.backlight();\n  pinMode(RELAY, OUTPUT);\n}\n\nvoid loop() {\n  float t = dht.readTemperature();\n  bool hot = t > LIMIT;\n  digitalWrite(RELAY, hot);\n\n  lcd.setCursor(0, 0);\n  lcd.print("Temp: ");\n  lcd.print(t, 1);\n  lcd.print(" C  ");\n  lcd.setCursor(0, 1);\n  lcd.print(hot ? "Fan: ON     " : "Fan: off    ");\n  delay(1000);\n}',
    phrases: [
      ['Suhu: ', 'Temp: '],
      ['Kipas: NYALA', 'Fan: ON     '],
      ['Kipas: mati ', 'Fan: off    '],
      ['kipas NYALA', 'fan ON'],
      ['kipas mati', 'fan off'],
    ],
  },
};
