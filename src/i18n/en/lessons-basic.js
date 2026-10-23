// English translations for the Basic lessons (overlay on the Indonesian source).
// Arrays line up with the source by index; params by key. See src/i18n/lessons.js.

const COLORS = ['Red', 'Yellow', 'Green', 'Blue', 'White'];

export default {
  board: {
    title: 'Meet the board',
    heading: 'Arduino Uno',
    summary:
      'The Arduino Uno is a microcontroller board built around the ATmega328P. It is affordable, easy to program over USB, and great for learning electronics or building prototypes.',
    features: ['Open-source hardware', 'A huge community with thousands of examples', 'Used in schools, hobbies and industry'],
    callouts: [
      ['USB port', 'To the computer: for programming and power.'],
      ['Microcontroller', 'The ATmega328P runs your code.'],
      ['Digital pins', 'Pins 0–13 for digital input/output (~ = PWM).'],
      ['Power jack', 'Power from a 7–12 V adapter.'],
      ['Power pins', '5V, 3.3V, GND and VIN for your circuits.'],
      ['Analog pins', 'A0–A5 read analog signals.'],
    ],
    explain: [
      '<code>setup()</code> runs once when the board powers up or is reset.',
      '<code>pinMode(LED_BUILTIN, OUTPUT)</code> makes pin 13 — wired to the “L” LED on the board — an output.',
      '<code>loop()</code> then repeats forever. <code>digitalWrite(…, HIGH)</code> puts 5 V on the pin so the LED lights up.',
    ],
    tip: 'Press <b>Run</b> to upload: the TX/RX lights blink, then the “L” LED turns on. Click parts of the board to learn what they do.',
    pinout: [
      'Digital input/output (D0 = RX, D1 = TX)',
      'PWM pins — can be “half on” with analogWrite()',
      'Analog input, read as 0–1023 (A4/A5 are also I²C)',
      'Supply voltage for sensors and modules',
      'Ground — the shared 0 V point',
      'Voltage from the power jack (7–12 V)',
    ],
    specs: {
      name: 'Arduino Uno R3',
      rows: [
        ['Microcontroller', 'ATmega328P'],
        ['Operating voltage', '5 V'],
        ['Input voltage', '7–12 V'],
        ['Digital I/O pins', '14 (6 PWM)'],
        ['Analog inputs', '6'],
        ['Flash memory', '32 KB'],
        ['SRAM / EEPROM', '2 KB / 1 KB'],
        ['Clock speed', '16 MHz'],
        ['Size', '68.6 × 53.4 mm'],
      ],
    },
  },

  blink: {
    title: 'Blink an LED',
    heading: 'Blink an LED',
    summary:
      'Your first circuit: an LED and a resistor on a breadboard, controlled by pin 13. Turning that pin on and off with a pause in between makes the LED blink.',
    features: ['Digital output with <code>digitalWrite()</code>', 'Click the resistor to try other values', 'Click the LED to change its color and tempo'],
    callouts: [
      ['GND', 'The short leg (−) carries current back to the board.'],
      ['Pin 13', 'The sketch switches this pin on and off.'],
      ['LED', 'Lights up when pin 13 is HIGH.'],
      ['Built-in LED', 'The “L” LED on the board follows pin 13.'],
      ['Resistor', 'Limits the current so the LED is not damaged.'],
    ],
    params: { color: { label: 'Color', options: COLORS }, on: { label: 'On' }, off: { label: 'Off' }, ohms: { label: 'Resistor value' } },
    explain: [
      '<code>const int LED_PIN = 13;</code> gives pin 13 an easy-to-read name.',
      'In <code>setup()</code>, <code>pinMode(LED_PIN, OUTPUT)</code> lets the pin drive current.',
      '<code>loop()</code> writes HIGH, waits, writes LOW, then waits again. Those two pauses set the rhythm of the blink.',
    ],
    tip: 'A bigger resistor lets less current through: try 10 kΩ and watch the LED dim.',
    pinout: ['Resistor → long LED leg (+)', 'Short LED leg (−)'],
    specs: {
      name: '5 mm LED',
      rows: [
        ['Diameter', '5 mm'],
        ['Forward voltage', '± 2 V (red) – 3 V (blue/white)'],
        ['Operating current', '10–20 mA'],
        ['Long leg', 'Anode (+)'],
        ['Short leg', 'Cathode (−)'],
        ['Typical resistor', '220–330 Ω at 5 V'],
      ],
    },
  },

  button: {
    title: 'Press a button',
    heading: 'Press a button',
    summary:
      'Inputs let the board “feel” the world. The push button connects pin 2 to 5 V while pressed; a pull-down resistor keeps the pin at 0 V when it is released.',
    features: ['Click and hold the button in the 3D view', 'Read a pin with <code>digitalRead()</code>', 'Choose “hold” or “toggle” logic'],
    callouts: [
      ['Push button', 'Click and hold — pin 2 reads HIGH.'],
      ['LED', 'The sketch decides when it lights up.'],
      ['Pin 2 (input)', '<code>digitalRead()</code> sees HIGH or LOW.'],
      ['Pull-down', '10 kΩ keeps pin 2 LOW when released.'],
    ],
    params: { mode: { label: 'Logic', options: ['Hold', 'Toggle'] } },
    explain: [
      '<code>pinMode(BUTTON, INPUT)</code> makes pin 2 “listen” instead of driving current.',
      '<code>digitalRead(BUTTON)</code> is HIGH while the button is pressed, LOW otherwise.',
      'In <b>hold</b> mode the LED simply copies the button.',
      'In <b>toggle</b> mode the sketch remembers the last reading and flips the LED on every new press.',
    ],
    tip: 'With <code>INPUT_PULLUP</code> you do not need a pull-down resistor — but the logic is inverted: pressed = LOW.',
    pinout: ['One side of the button', 'Other side of the button + 10 kΩ resistor', 'Pull-down resistor end', '220 Ω resistor → LED'],
    specs: {
      name: '6×6 mm push button',
      rows: [
        ['Type', 'Momentary (springs back)'],
        ['Legs', '4 (connected in pairs)'],
        ['Max voltage', '12 V DC'],
        ['Max current', '50 mA'],
        ['Lifetime', '± 100,000 presses'],
      ],
    },
    optionCode: { 'mode.toggle': { logic: '  int now = digitalRead(BUTTON);\n  if (now == HIGH && last == LOW) {\n    lit = !lit;\n    digitalWrite(LED, lit);\n    delay(30);  // debounce\n  }\n  last = now;' } },
  },

  knob: {
    title: 'Turn a knob',
    heading: 'Turn a knob',
    summary:
      'A potentiometer is a resistor with a slider. Turning the knob moves its middle leg anywhere between 0 V and 5 V, and the analog pin turns that voltage into a number.',
    features: ['Drag the knob to turn it', '<code>analogRead()</code> gives 0–1023', '<code>analogWrite()</code> dims the LED, 0–255'],
    callouts: [
      ['Potentiometer', 'Drag the knob to turn it.'],
      ['LED', 'Its brightness follows the knob.'],
      ['Pin A0', 'Reads the knob as a number 0–1023.'],
      ['Pin ~9 (PWM)', 'Dims the LED with fast pulses.'],
    ],
    params: { value: { label: 'Knob position' }, color: { label: 'Color', options: COLORS } },
    explain: [
      '<code>analogRead(POT)</code> measures the middle leg: 0 V becomes 0, 5 V becomes 1023.',
      'PWM only goes up to 255, so <code>value / 4</code> scales the reading down to fit.',
      '<code>analogWrite(LED, …)</code> switches pin 9 on and off very fast so the LED looks dimmer.',
    ],
    tip: 'Press Run and open the Serial Monitor to watch the number change as you turn the knob.',
    pinout: ['Left potentiometer leg', 'Middle leg (wiper)', 'Right potentiometer leg', '220 Ω resistor → LED'],
    specs: {
      name: 'Rotary potentiometer',
      rows: [
        ['Resistance', '10 kΩ'],
        ['Rotation', '± 270°'],
        ['Legs', '3 (end, wiper, end)'],
        ['Taper', 'Linear (B10K)'],
        ['Power', '0.1 W'],
      ],
    },
  },

  rgb: {
    title: 'Mix colors',
    heading: 'Mix colors',
    summary:
      'An RGB LED holds three LEDs — red, green and blue — under one milky lens. Set the brightness of each with PWM and the light mixes into almost any color.',
    features: ['Click the LED to mix colors', 'Three PWM pins: <code>9</code>, <code>10</code>, <code>11</code>', 'One resistor per color'],
    callouts: [
      ['RGB LED', 'Three colors in one lens — click to mix.'],
      ['220 Ω resistors', 'Keep the current of each color safe.'],
      ['Pins ~9 ~10 ~11', 'One PWM pin per color.'],
      ['Common cathode', 'The longest leg goes to GND.'],
    ],
    params: {
      preset: { label: 'Preset color', options: ['Purple', 'Cyan', 'Orange', 'Pink', 'White'] },
      r: { label: 'Red' },
      g: { label: 'Green' },
      b: { label: 'Blue' },
    },
    explain: [
      'Pins <code>9</code>, <code>10</code> and <code>11</code> support PWM, so each color can be dimmed on its own.',
      '<code>analogWrite(RED, 170)</code> runs the red LED at 170 out of 255 — about two thirds brightness.',
      'The mixing happens in your eye: red + blue looks purple, all three at full look white.',
    ],
    tip: 'Change the numbers in the code from the inspector: click the LED, then slide Red, Green and Blue.',
    pinout: ['Resistor → red leg (R)', 'Resistor → green leg (G)', 'Resistor → blue leg (B)', 'Longest leg (common cathode)'],
    specs: {
      name: '5 mm RGB LED',
      rows: [
        ['Type', 'Common cathode'],
        ['Legs', '4 (R, −, G, B)'],
        ['Forward voltage', 'R ± 2 V · G/B ± 3 V'],
        ['Current per color', '20 mA max'],
        ['Lens', 'Milky (diffused)'],
      ],
    },
  },

  light: {
    title: 'Sense light',
    heading: 'Sense light',
    summary:
      'An LDR (light-dependent resistor) lets more current through the more light falls on it. Paired with a fixed resistor it turns light and dark into a voltage — perfect for a night light that switches on by itself.',
    features: ['Read brightness with <code>analogRead()</code>', 'Drag the lamp away, or switch it off', 'The LED lights below a threshold'],
    callouts: [
      ['Night light', 'Lights up when the reading means “dark”.'],
      ['Light sensor', 'Its resistance drops as it gets brighter.'],
      ['Pin A0', 'Reads the voltage divider, 0–1023.'],
      ['Desk lamp', 'Drag it away, or click to switch it off.'],
    ],
    params: { lamp: { label: 'Lamp', options: ['On', 'Off'] }, dist: { label: 'Lamp distance' }, threshold: { label: 'Dark threshold' } },
    explain: [
      'The LDR and a 10 kΩ resistor form a voltage divider: the brighter it is, the lower the LDR resistance and the higher the voltage at A0.',
      '<code>analogRead(SENSOR)</code> turns that voltage into a number from 0 (dark) to 1023 (very bright).',
      'If the reading is below <code>DARK</code>, the sketch decides it is dark and turns the LED on.',
    ],
    tip: 'Move the lamp while watching the Serial Monitor — light fades quickly with distance.',
    pinout: ['One LDR leg', 'Midpoint of LDR + 10 kΩ resistor', 'End of the 10 kΩ resistor', '220 Ω resistor → LED'],
    specs: {
      name: 'GL5528 LDR',
      rows: [
        ['Light resistance (10 lux)', '8–20 kΩ'],
        ['Dark resistance', '± 1 MΩ'],
        ['Response time', '20–30 ms'],
        ['Max voltage', '150 V DC'],
        ['Peak sensitivity', '540 nm (yellow-green)'],
      ],
    },
  },

  distance: {
    title: 'Measure distance',
    heading: 'Measure distance',
    summary:
      'The HC-SR04 sends out a burst of ultrasound and listens for the echo. How long the echo takes to come back tells how far away the obstacle is — click the obstacle to swap it, or drag it closer.',
    features: ['Send a ping, time the echo with <code>pulseIn()</code>', 'Swap obstacles: some reflect better', 'Set how often to measure'],
    callouts: [
      ['Distance sensor', 'Sends a sound, then waits for the echo.'],
      ['Echo', 'HIGH while the sound is still travelling.'],
      ['5V & GND', 'The sensor is powered straight from the board.'],
      ['Obstacle', 'Drag it closer or further away.'],
    ],
    params: { kind: { label: 'Obstacle', options: ['Car', 'Box', 'Ball'] }, dist: { label: 'Distance' }, interval: { label: 'Measuring interval' } },
    explain: [
      '<code>Serial.begin(9600)</code> opens the Serial Monitor at 9600 baud.',
      'A 10 µs pulse on <code>TRIG</code> makes the sensor emit eight 40 kHz waves.',
      '<code>pulseIn(ECHO, HIGH)</code> measures the echo time in microseconds.',
      'Dividing by 58 gives centimeters (the sound travels there and back).',
    ],
    tip: 'A soft ball absorbs sound: the reading jumps around or shows 0. That is why robots are often fooled by soft objects.',
    pinout: ['Sensor VCC', 'Trig (trigger)', 'Echo', 'Sensor GND'],
    specs: {
      name: 'HC-SR04',
      rows: [
        ['Range', '2–400 cm'],
        ['Accuracy', '± 3 mm'],
        ['Frequency', '40 kHz'],
        ['Beam angle', '± 15°'],
        ['Voltage', '5 V DC'],
        ['Trigger', '10 µs HIGH pulse'],
      ],
    },
  },

  sound: {
    title: 'Play a tune',
    heading: 'Play a tune',
    summary:
      'A piezo buzzer “clicks” every time its pin changes state. Do that hundreds of times a second and you hear a tone — which is exactly what <code>tone()</code> does.',
    features: ['Play notes with <code>tone(pin, Hz, ms)</code>', 'Click the buzzer to choose a tune and tempo', 'Sound can be muted in Settings'],
    callouts: [
      ['Piezo buzzer', '<code>tone()</code> vibrates it at the note’s pitch.'],
      ['Pin 8', 'A timer in the chip keeps the pitch exact.'],
      ['GND', 'The short buzzer leg goes to ground.'],
    ],
    params: { melody: { label: 'Tune', options: ['Scale', 'Twinkle Twinkle', 'Ode to Joy'] }, note: { label: 'Note length' } },
    explain: [
      'The <code>melody</code> array stores the frequency of each note in hertz: 262 Hz is middle C.',
      '<code>tone(BUZZER, hz, ms)</code> plays a square wave for <code>ms</code> milliseconds.',
      'The <code>delay</code> after each note adds a short gap so repeated notes stay separate.',
      'After the last note, the loop rests for a second and starts again.',
    ],
    tip: 'An <b>active</b> buzzer can only play one tone. For melodies, use a <b>passive</b> buzzer like this one.',
    pinout: ['Buzzer + leg', 'Buzzer − leg'],
    specs: {
      name: 'Passive piezo buzzer',
      rows: [
        ['Voltage', '3–5 V'],
        ['Tone range', '± 100 Hz – 10 kHz'],
        ['Loudest', '± 2–4 kHz'],
        ['Current', '< 30 mA'],
        ['Diameter', '12 mm'],
      ],
    },
  },

  motor: {
    title: 'Spin a motor',
    heading: 'Control a motor',
    summary:
      'An Arduino pin is not strong enough to drive a motor on its own, so a transistor carries the heavy load. PWM switches it on and off very fast to set the speed.',
    features: ['Speed 0–255 with <code>analogWrite()</code>', 'A TIP120 carries the motor current', 'Click the motor to change the ramp'],
    callouts: [
      ['Pin ~6 (PWM)', '<code>analogWrite()</code> sets the speed, 0–255.'],
      ['1 kΩ resistor', 'Keeps the base current safe for the pin.'],
      ['Transistor', 'A small base current switches the motor on.'],
      ['DC motor', 'Click to change the speed ramp.'],
    ],
    params: { top: { label: 'Top speed' }, step: { label: 'Ramp step' } },
    explain: [
      '<code>analogWrite(MOTOR, s)</code> sets the PWM duty cycle: 0 is off, 255 is full on.',
      'The <code>for</code> loop raises <code>s</code> a little every 40 ms — a smooth ramp.',
      'After holding top speed, writing 0 lets the motor coast to a stop.',
    ],
    tip: 'In a real circuit, put a diode (e.g. 1N4001) across the motor to absorb the voltage spike when it switches off.',
    pinout: ['1 kΩ resistor → transistor base', 'Transistor emitter', 'Motor + terminal', 'Motor − terminal → collector'],
    specs: {
      name: 'TIP120 + 130 DC motor',
      rows: [
        ['Transistor', 'NPN Darlington TIP120'],
        ['Max collector current', '5 A'],
        ['Gain (hFE)', '≥ 1000'],
        ['Motor', '3–6 V DC'],
        ['No-load speed', '± 9,000 rpm @ 3 V'],
      ],
    },
    code: 'const int MOTOR = 6;  // PWM pin\n\nvoid setup() {\n  pinMode(MOTOR, OUTPUT);\n}\n\nvoid loop() {\n  for (int s = 0; s <= {{top}}; s += {{step}}) {\n    analogWrite(MOTOR, s);\n    delay(40);\n  }\n  delay(1500);\n  analogWrite(MOTOR, 0);\n  delay(1500);\n}',
  },

  servo: {
    title: 'Move a servo',
    heading: 'Move a servo',
    summary:
      'A servo is a motor that knows its own position. Give it an angle from 0° to 180° and it turns there and holds — great for robot arms, little doors or gauge needles.',
    features: ['Set the position with <code>arm.write(angle)</code>', 'The Servo library makes the pulses for you', 'Click the servo to change its range and speed'],
    callouts: [
      ['SG90 servo', 'Turns to the commanded angle.'],
      ['Pin ~9', 'Sends a position pulse every 20 ms.'],
      ['5V & GND', 'The red and brown wires supply power.'],
    ],
    params: { from: { label: 'From' }, to: { label: 'To' }, speed: { label: 'Delay per degree' } },
    explain: [
      '<code>#include &lt;Servo.h&gt;</code> loads the library; <code>Servo arm;</code> creates one servo.',
      '<code>arm.attach(9)</code> starts sending position pulses on pin 9.',
      'The first <code>for</code> loop raises the angle one degree at a time, the second brings it back down.',
      '<code>delay</code> sets the sweep speed: smaller is faster.',
    ],
    tip: 'Servos can draw a lot of current when they start moving. For more than one servo, use a separate power supply.',
    pinout: ['Signal wire (orange)', 'Power wire (red)', 'Ground wire (brown)'],
    specs: {
      name: 'SG90 micro servo',
      rows: [
        ['Angle', '0–180°'],
        ['Torque', '1.8 kg·cm @ 4.8 V'],
        ['Speed', '0.1 s / 60°'],
        ['Voltage', '4.8–6 V'],
        ['Signal', '1–2 ms pulse every 20 ms'],
        ['Weight', '9 g'],
      ],
    },
  },

  project: {
    title: 'Build a project',
    heading: 'Parking sensor',
    summary:
      'Put it all together: a distance sensor watches the car, and a traffic light tells the driver when to stop. Click the light to move the distance thresholds.',
    features: ['Decisions with comparisons', 'Three outputs, one per color', 'Reuses the distance code from lesson 7'],
    callouts: [
      ['Distance sensor', 'Keeps watching for obstacles.'],
      ['Traffic light', 'Click to change the distance thresholds.'],
      ['Your logic', 'Comparisons pick which light is on.'],
      ['Obstacle', 'Drag it closer and watch the light.'],
    ],
    params: { near: { label: 'Red if ≤' }, far: { label: 'Green if >' }, dist: { label: 'Car distance' } },
    explain: [
      'The loop measures the distance exactly as in lesson 7.',
      'A comparison like <code>cm &gt; 25</code> is true (1) or false (0).',
      'Writing it straight to a pin turns the LED on or off — no <code>if</code> needed.',
      'Only one condition can be true at a time, so exactly one light is on.',
    ],
    tip: 'Add the buzzer from lesson 8 and make it beep faster as the car gets closer — just like a real parking sensor.',
    pinout: ['Sensor Trig · Echo', 'Red LED', 'Yellow LED', 'Green LED', 'Power for the sensor and light module'],
    specs: {
      name: 'Traffic light module',
      rows: [
        ['LEDs', 'Red, yellow, green 8 mm'],
        ['Resistors', 'Built into the module'],
        ['Voltage', '3.3–5 V'],
        ['Pins', 'GND, R, Y, G'],
        ['Logic', 'HIGH = on'],
      ],
    },
  },
};
