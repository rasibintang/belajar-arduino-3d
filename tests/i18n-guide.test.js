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

import { ISSUE_CODES } from '../src/sim/wiring/check.js';

test('teks masalah, panel, dan tombol pindah tersedia dalam ID dan EN', () => {
  const NO_FIX = ['short', 'led-resistor'];
  for (const lang of ['id', 'en']) {
    for (const code of ISSUE_CODES) {
      const text = UI[lang][`guide.issue.${code}`];
      assert.ok(text, `${lang}: guide.issue.${code}`);
      assert.ok(text.includes('{pin}') && text.includes('{target}'), `${lang}: ${code} memakai {pin} dan {target}`);
      if (!NO_FIX.includes(code)) assert.ok(text.includes('{suggest}'), `${lang}: ${code} memakai {suggest}`);
    }
    assert.ok(UI[lang]['guide.panel']?.includes('{n}'), `${lang}: guide.panel`);
    assert.ok(UI[lang]['guide.fix']?.includes('{suggest}'), `${lang}: guide.fix`);
    assert.ok(UI[lang]['guide.empty'], `${lang}: guide.empty`);
  }
});
