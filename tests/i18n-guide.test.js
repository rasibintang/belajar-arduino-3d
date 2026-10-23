import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../src/i18n/ui.js';
import { PIN_FNS } from '../src/sim/wiring/pin-functions.js';

test('label panduan kabel tersedia dalam ID dan EN untuk setiap fungsi', () => {
  for (const lang of ['id', 'en']) {
    assert.ok(UI[lang]['guide.toggle'], `${lang}: guide.toggle`);
    for (const fn of PIN_FNS) {
      if (['neutral', 'hole', 'mcu-other'].includes(fn)) continue;
      assert.ok(UI[lang][`guide.hint.${fn}`], `${lang}: guide.hint.${fn}`);
    }
  }
});
