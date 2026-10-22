// Pewarnaan sintaks sederhana untuk kode Arduino (C++).

const KEYWORDS = new Set(
  ('void int long bool boolean const for if else while do return true false sizeof unsigned float double char byte static ' +
    'enum switch case break default volatile').split(' ')
);
const CONSTANTS = new Set(
  'HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN A0 A1 A2 A3 A4 A5 LSBFIRST MSBFIRST FALLING RISING CHANGE DHT11 NEO_GRB NEO_KHZ800'.split(' ')
);
const TYPES = new Set([
  'Servo', 'Serial', 'String', 'DHT', 'LiquidCrystal_I2C', 'Keypad', 'Stepper', 'RTC_DS3231', 'DateTime',
  'Adafruit_NeoPixel', 'EEPROM', 'State', 'Wire',
]);

// komentar | preprocessor | string / karakter | angka | nama (+ "(" jika panggilan) | tanda baca | spasi | sisa
const TOKEN =
  /(\/\/[^\n]*)|(#\w+[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(\s*\()?|([^\w\s"'#/]+|\/)|(\s+)|([\s\S])/g;

export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Ubah kode menjadi HTML berwarna (tanpa nomor baris). */
export function highlight(code) {
  let out = '';
  for (const m of code.matchAll(TOKEN)) {
    const [all, comment, pre, str, num, ident, call, punct, space] = m;
    if (comment) out += `<span class="t-com">${escapeHtml(comment)}</span>`;
    else if (pre) out += `<span class="t-pre">${escapeHtml(pre)}</span>`;
    else if (str) out += `<span class="t-str">${escapeHtml(str)}</span>`;
    else if (num) out += `<span class="t-num">${num}</span>`;
    else if (ident) {
      let cls = '';
      if (KEYWORDS.has(ident)) cls = 't-kw';
      else if (CONSTANTS.has(ident)) cls = 't-const';
      else if (TYPES.has(ident)) cls = 't-type';
      else if (call) cls = 't-fn';
      out += cls ? `<span class="${cls}">${ident}</span>` : ident;
      if (call) out += escapeHtml(call);
    } else if (punct) out += escapeHtml(punct);
    else if (space) out += space;
    else out += `<span class="t-str">${escapeHtml(all)}</span>`; // tanda kutip yang terpotong oleh angka parameter
  }
  return out;
}
