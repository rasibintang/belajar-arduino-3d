import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/account/config.js';
import { fromProjectRow, toProjectRow, toAccountError } from '../src/account/supabase-map.js';

test('konfigurasi kosong atau contoh → null', () => {
  assert.equal(readConfig({}), null);
  assert.equal(readConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_ANON_KEY: 'k' }), null);
  assert.equal(readConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'your-anon-key' }), null);
});

test('konfigurasi sah → url & anonKey', () => {
  assert.deepEqual(readConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: ' eyJabc ' }), { url: 'https://x.supabase.co', anonKey: 'eyJabc' });
});

test('baris proyek ↔ objek proyek', () => {
  const diagram = { parts: [], wires: [] };
  assert.deepEqual(fromProjectRow({ id: '1', owner: 'u', name: 'A', sketch: '', diagram, eeprom: null, updated_at: '2026-10-24T00:00:00Z' }), {
    id: '1',
    owner: 'u',
    name: 'A',
    sketch: '',
    diagram,
    eeprom: null,
    updatedAt: '2026-10-24T00:00:00Z',
  });
  assert.deepEqual(toProjectRow({ id: '1', owner: 'u', updatedAt: 'x', name: ' A ', sketch: 's', diagram, eeprom: null }), { name: 'A', sketch: 's', diagram, eeprom: null });
});

test('kesalahan PostgREST/jaringan → AccountError', () => {
  assert.equal(toAccountError({ code: '42501', message: 'rls' }).code, 'forbidden');
  assert.equal(toAccountError({ code: '23514', message: 'check' }).code, 'invalid');
  assert.equal(toAccountError({ code: 'PGRST301', message: 'JWT expired' }).code, 'not-signed-in');
  assert.equal(toAccountError(new TypeError('Failed to fetch')).code, 'network');
});
