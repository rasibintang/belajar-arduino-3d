import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../src/i18n/ui.js';

const KEYS = {
  akun: ['acct.signIn', 'acct.signOut', 'acct.admin', 'acct.offline', 'acct.notice', 'acct.noticeOk', 'acct.menu'],
  proyek: ['proj.save', 'proj.saveNow', 'proj.mine', 'proj.badge.cloud', 'proj.badge.local', 'proj.savedCloud', 'proj.autosaveFail', 'proj.open', 'proj.rename', 'proj.delete', 'proj.renamePrompt', 'proj.deleteConfirm', 'proj.empty', 'proj.copyName', 'proj.needSignIn', 'proj.notFound', 'proj.updated', 'proj.copyOpened'],
};

for (const [group, keys] of Object.entries(KEYS)) {
  test(`teks ${group} tersedia dalam ID dan EN`, () => {
    for (const lang of ['id', 'en']) for (const k of keys) assert.ok(UI[lang][k], `${lang}: ${k}`);
  });
}
