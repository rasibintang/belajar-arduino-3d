// Pasang arduino-cli portabel + core AVR + library ke folder tools/ (untuk server kompilasi).
//   npm run setup:arduino
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = join(ROOT, 'tools');
const CLI_DIR = join(TOOLS, 'arduino-cli');
const WIN = process.platform === 'win32';
const CLI = join(CLI_DIR, WIN ? 'arduino-cli.exe' : 'arduino-cli');
const CONFIG = join(CLI_DIR, 'arduino-cli.yaml');
const LIBRARIES = ['Servo', 'LiquidCrystal I2C', 'DHT sensor library', 'Adafruit Unified Sensor', 'Adafruit NeoPixel', 'Keypad', 'RTClib', 'Stepper'];

function assetName() {
  const arch = { x64: '64bit', arm64: 'ARM64', arm: 'ARMv7' }[process.arch] ?? '64bit';
  if (WIN) return `Windows_${arch}.zip`;
  if (process.platform === 'darwin') return `macOS_${arch}.tar.gz`;
  return `Linux_${arch}.tar.gz`;
}

async function downloadCli() {
  if (existsSync(CLI)) return console.log('✓ arduino-cli sudah ada');
  const rel = await (await fetch('https://api.github.com/repos/arduino/arduino-cli/releases/latest')).json();
  const asset = rel.assets.find((a) => a.name.endsWith(assetName()));
  if (!asset) throw new Error(`Tidak ada arduino-cli untuk ${process.platform}/${process.arch}`);
  console.log(`↓ ${asset.name}`);
  mkdirSync(CLI_DIR, { recursive: true });
  const file = join(TOOLS, asset.name);
  writeFileSync(file, Buffer.from(await (await fetch(asset.browser_download_url)).arrayBuffer()));
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
cli(['core', 'install', 'arduino:avr']);
for (const lib of LIBRARIES) cli(['lib', 'install', lib]);
console.log('\n✓ Server kompilasi siap. Jalankan `npm run dev` (atau `npm run compile-server`).');
