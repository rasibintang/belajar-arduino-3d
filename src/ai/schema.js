// Bentuk jawaban AI (structured output). Rangkaian *logis*: komponen dari katalog + sambungan
// pin-ke-pin + sketch. Posisi, breadboard, dan lubang dihitung tata letak (layout.js), bukan AI.
// Mode JSON ketat: setiap objek tertutup (additionalProperties: false) dan semua field wajib,
// jadi props ditulis sebagai daftar { key, value } dengan nilai teks.

const str = (description) => ({ type: 'string', description });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items, description) => ({ type: 'array', items, description });

export const CIRCUIT_SCHEMA = obj({
  title: str('Short project name, in the requested language'),
  summary: str('2-4 sentences: what the circuit does and how it is wired, in the requested language'),
  feasible: { type: 'boolean', description: 'false when the goal cannot be reached with catalog components' },
  parts: list(
    obj({
      id: str('Lowercase id, e.g. uno, r1, led1, oled1. The Arduino is always "uno".'),
      type: str('Component type from the catalog'),
      props: list(obj({ key: str('Prop key from the catalog'), value: str('Prop value as text') }), 'Only props that differ from the default'),
    }),
    'Every component, including { id: "uno", type: "arduino-uno" }; never a breadboard'
  ),
  connections: list(obj({ from: str('"part:pin"'), to: str('"part:pin"') }), 'One wire per pair of pins'),
  sketch: str('Complete sketch.ino for Arduino Uno'),
  substitutions: list(
    obj({ requested: str('What the user asked for'), used: str('Catalog type used instead'), reason: str('Why, in the requested language') }),
    'Components replaced by a catalog alternative'
  ),
  missing: list(obj({ component: str('Missing component, in plain words'), reason: str('Why it is needed, in the requested language') }), 'Components the catalog lacks'),
  changes: list(str('One change, in the requested language'), 'Modify mode: what changed compared with the current circuit; otherwise empty'),
});
