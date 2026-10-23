import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../src/i18n/ui.js';

const KEYS = {
  akun: ['acct.signIn', 'acct.signOut', 'acct.admin', 'acct.offline', 'acct.notice', 'acct.noticeOk', 'acct.menu'],
};

for (const [group, keys] of Object.entries(KEYS)) {
  test(`teks ${group} tersedia dalam ID dan EN`, () => {
    for (const lang of ['id', 'en']) for (const k of keys) assert.ok(UI[lang][k], `${lang}: ${k}`);
  });
}
