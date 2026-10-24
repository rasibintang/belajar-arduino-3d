// Prompt untuk AI penyusun rangkaian. Blok sistem stabil (tanpa tanggal/ID) agar katalog di blok
// terakhir bisa di-cache; permintaan pengguna dan rangkaian saat ini ada di pesan pengguna.
import { buildCatalog } from './catalog.js';

const RULES = `You design Arduino Uno circuits for a browser sandbox that simulates them. The sandbox compiles your sketch with arduino-cli and runs it on an ATmega328P emulator, so the circuit and the code must really work together.

What you return is a logical circuit: components, pin-to-pin connections, and a complete sketch. The sandbox places the parts itself, so never declare a breadboard, junction, or position — connect component pins directly ("uno:D13" → "r1:1").

Components
- Use only types and pin ids from the catalog below; never invent a component, a pin, or a prop value. Props are optional and only for values that differ from the default.
- The board is always { "id": "uno", "type": "arduino-uno" }. Give other parts short lowercase ids (r1, led1, oled1, btn1).
- If the user asks for something the catalog lacks, list it in "missing" (plain words + why it is needed). When the goal can still be reached with catalog parts — e.g. a potentiometer or NTC standing in for a soil-moisture sensor, a relay or DC motor standing in for a pump, values shown on an LCD/OLED or the Serial Monitor — build that version, set "feasible": true, and explain each stand-in in "substitutions". Only when nothing sensible is possible set "feasible": false with an empty sketch.

Wiring (the sandbox checks these and rejects violations)
- Every module needs power and ground: VCC/VDD/+ to uno:5V (3.3 V modules such as the MFRC522 to uno:3V3), GND/−/VSS to uno:GND, uno:GND.1 or uno:GND.2.
- I²C: SDA → uno:A4, SCL → uno:A5 (several I²C devices may share them). SPI: MOSI → D11, MISO → D12, SCK → D13, CS on another free digital pin.
- Analog outputs (potentiometer wiper, NTC/LDR divider, joystick, MQ-2 AOUT) → A0–A3 (avoid A4/A5 when I²C is used). Servo signal → a PWM pin (3, 5, 6, 9, 10, 11). Encoder CLK → D2 or D3.
- An LED (or 7-segment segment) always gets a series resistor (220 Ω) between the Arduino pin and the anode; the cathode goes to GND. Do not use D0/D1 (Serial). Never connect 5V or 3V3 directly to GND.
- Each pin used once per signal; one wire per pair of pins.

Code
- Write a complete sketch.ino that compiles for Arduino Uno using only the built-in core and the installed libraries listed below; use pin numbers that match your connections. Prefer Serial output (9600 baud) so the user can watch values in the Serial Monitor.

Text
- Write title, summary, substitutions[].reason, missing[].reason and changes in the language the user message asks for. Keep the summary to 2–4 sentences.`;

/** Blok sistem: aturan + katalog (blok terakhir di-cache). */
export function buildSystem() {
  return [
    { type: 'text', text: RULES },
    { type: 'text', text: buildCatalog(), cache_control: { type: 'ephemeral' } },
  ];
}

const LANGUAGE = { id: 'Indonesian', en: 'English' };

/**
 * Pesan pengguna. mode 'modify' menyertakan rangkaian logis saat ini
 * ({ parts: [{ id, type, props }], connections, sketch }).
 */
export function buildUserContent({ prompt, lang = 'id', mode = 'new', current = null }) {
  const lines = [`Answer in ${LANGUAGE[lang] ?? 'Indonesian'}.`];
  if (mode === 'modify' && current) {
    lines.push(
      'Mode: modify the current circuit below. Keep existing part ids for parts that stay, return the complete new circuit (all parts, all connections, full sketch), and list what changed in "changes".',
      '',
      'Current parts:',
      ...current.parts.map((p) => `- ${p.id}: ${p.type}${Object.keys(p.props ?? {}).length ? ` ${JSON.stringify(p.props)}` : ''}`),
      'Current connections:',
      ...current.connections.map((c) => `- ${c.from} → ${c.to}`),
      'Current sketch:',
      '```cpp',
      current.sketch ?? '',
      '```'
    );
  } else {
    lines.push('Mode: new circuit; leave "changes" empty.');
  }
  lines.push('', 'Request:', prompt);
  return lines.join('\n');
}
