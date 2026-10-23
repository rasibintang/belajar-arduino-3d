import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../src/i18n/ui.js';

const KEYS = {
  akun: ['acct.signIn', 'acct.signOut', 'acct.admin', 'acct.offline', 'acct.notice', 'acct.noticeOk', 'acct.menu'],
  proyek: ['proj.save', 'proj.saveNow', 'proj.mine', 'proj.badge.cloud', 'proj.badge.local', 'proj.savedCloud', 'proj.autosaveFail', 'proj.open', 'proj.rename', 'proj.delete', 'proj.renamePrompt', 'proj.deleteConfirm', 'proj.empty', 'proj.copyName', 'proj.needSignIn', 'proj.notFound', 'proj.updated', 'proj.copyOpened'],
  pengelola: ['adm.title', 'adm.forbidden', 'adm.notConfigured', 'adm.signInFirst', 'adm.tab.requests', 'adm.tab.projects', 'adm.tab.users', 'adm.tab.settings', 'adm.noRequests', 'adm.noProjects', 'adm.openCopy', 'adm.limit', 'adm.limitHelp', 'adm.saved', 'adm.invalidLimit', 'adm.col.component', 'adm.col.requests', 'adm.col.users', 'adm.col.last', 'adm.col.examples', 'adm.col.project', 'adm.col.owner', 'adm.col.updated', 'adm.col.email', 'adm.col.name', 'adm.col.projects', 'adm.col.aiToday', 'adm.col.aiTotal', 'adm.col.lastSeen', 'adm.save', 'adm.loadFailed'],
};

for (const [group, keys] of Object.entries(KEYS)) {
  test(`teks ${group} tersedia dalam ID dan EN`, () => {
    for (const lang of ['id', 'en']) for (const k of keys) assert.ok(UI[lang][k], `${lang}: ${k}`);
  });
}
