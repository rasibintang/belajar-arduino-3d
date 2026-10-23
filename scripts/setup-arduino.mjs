// Pasang arduino-cli portabel + core AVR + library ke folder tools/ (untuk server kompilasi).
//   npm run setup:arduino
// Folder tujuan bisa diganti dengan TOOLS_DIR (mis. .vercel-toolchain saat build di Vercel).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = resolve(ROOT, process.env.TOOLS_DIR ?? 'tools');
// versi dipatok agar hasil build (mis. di Vercel) sama dengan yang sudah diuji
const CLI_VERSION = '1.5.1';
const AVR_CORE = 'arduino:avr@1.8.8';
const CLI_DIR = join(TOOLS, 'arduino-cli');
const WIN = process.platform === 'win32';
const CLI = join(CLI_DIR, WIN ? 'arduino-cli.exe' : 'arduino-cli');
const CONFIG = join(CLI_DIR, 'arduino-cli.yaml');
const LIBRARIES = [
  'Servo', 'LiquidCrystal', 'LiquidCrystal I2C', 'DHT sensor library', 'Adafruit Unified Sensor', 'Adafruit NeoPixel', 'Keypad', 'RTClib', 'Stepper',
  // gelombang 2
  'Adafruit SSD1306', 'Adafruit GFX Library', 'Adafruit SH110X', 'MFRC522', 'IRremote', 'OneWire', 'DallasTemperature', 'Adafruit MPU6050',
  'Adafruit BMP085 Library', 'TM1637', 'LedControl', 'MD_MAX72XX', 'MD_Parola', 'Adafruit PCD8544 Nokia 5110 LCD library', 'HX711', 'U8g2',
  // gelombang 3
  'Adafruit ILI9341', 'Adafruit FT6206 Library', 'SD', 'GxEPD2',
];

function assetName() {
  const arch = { x64: '64bit', arm64: 'ARM64', arm: 'ARMv7' }[process.arch] ?? '64bit';
  if (WIN) return `Windows_${arch}.zip`;
  if (process.platform === 'darwin') return `macOS_${arch}.tar.gz`;
  return `Linux_${arch}.tar.gz`;
}

async function downloadCli() {
  if (existsSync(CLI)) return console.log('✓ arduino-cli sudah ada');
  // server unduhan resmi Arduino (tanpa API GitHub yang dibatasi 60 permintaan/jam per IP)
  const name = `arduino-cli_${CLI_VERSION}_${assetName()}`;
  console.log(`↓ ${name}`);
  mkdirSync(CLI_DIR, { recursive: true });
  const res = await fetch(`https://downloads.arduino.cc/arduino-cli/${name}`);
  if (!res.ok) throw new Error(`Gagal mengunduh ${name}: HTTP ${res.status}`);
  const file = join(TOOLS, name);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  execFileSync('tar', ['-xf', file, '-C', CLI_DIR], { stdio: 'inherit' });
  rmSync(file);
}

function cli(args, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      execFileSync(CLI, ['--config-file', CONFIG, ...args], { stdio: 'inherit' });
      return;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`  (ulang ${i}/${retries - 1}…)`);
    }
  }
}

await downloadCli();
const p = (s) => s.replace(/\\/g, '/');
writeFileSync(CONFIG, `directories:\n  data: ${p(join(TOOLS, 'arduino-data'))}\n  downloads: ${p(join(TOOLS, 'arduino-data', 'staging'))}\n  user: ${p(join(TOOLS, 'arduino-user'))}\n`);
cli(['core', 'update-index']);
cli(['core', 'install', AVR_CORE]);
for (const lib of LIBRARIES) cli(['lib', 'install', lib]);
console.log('\n✓ Server kompilasi siap. Jalankan `npm run dev` (atau `npm run compile-server`).');
