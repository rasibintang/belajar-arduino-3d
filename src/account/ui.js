import { t } from '../i18n/index.js';
import { getAccount } from './index.js';
import './account.css';

const GOOGLE =
  '<svg viewBox="0 0 24 24" class="acct-g" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"/></svg>';

/** Pesan singkat di pojok layar. */
export function toast(text, kind = 'info') {
  const el = document.createElement('div');
  el.className = `acct-toast acct-toast-${kind}`;
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 4500);
}

function readFlag(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return '1'; // tanpa penyimpanan: jangan ganggu dengan pemberitahuan berulang
  }
}
function writeFlag(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* abaikan */
  }
}

/** Pemberitahuan sekali per akun: proyek di akun dapat dilihat pengelola. */
function showNotice(user) {
  const key = `la-account-notice:${user.id}`;
  if (readFlag(key)) return;
  const card = document.createElement('div');
  card.className = 'acct-notice';
  card.setAttribute('role', 'dialog');
  card.innerHTML = `<p></p><button type="button"></button>`;
  card.querySelector('p').textContent = t('acct.notice', { email: user.email });
  const ok = card.querySelector('button');
  ok.textContent = t('acct.noticeOk');
  ok.className = 'acct-notice-ok';
  ok.addEventListener('click', () => {
    writeFlag(key);
    card.remove();
  });
  document.body.append(card);
}

/**
 * Tombol akun di bilah atas. Tanpa backend (Supabase belum dikonfigurasi) slot dibiarkan kosong.
 * opts.buttonClass: kelas tombol halaman (top-btn / sb-btn); opts.menuItems(): [{ label, onClick }]
 * → { backend, user(), onChange(fn), refresh() }
 */
export async function mountAccount(slot, { buttonClass = 'top-btn', menuItems = () => [] } = {}) {
  const backend = await getAccount();
  const listeners = new Set();
  const api = {
    backend,
    user: () => backend?.user() ?? null,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refresh: () => render(),
  };
  if (!slot || !backend) {
    slot?.replaceChildren();
    return api;
  }
  slot.classList.add('acct');
  let admin = false;
  let menuOpen = false;

  async function afterSignIn(user) {
    backend.touch().catch(() => {});
    admin = await backend.admin.isAdmin().catch(() => false);
    showNotice(user);
  }

  function signIn() {
    backend.signIn().catch(() => toast(t('acct.offline'), 'error'));
  }

  function render() {
    const user = backend.user();
    slot.replaceChildren();
    if (!user) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `${buttonClass} acct-signin`;
      btn.innerHTML = `${GOOGLE}<span></span>`;
      btn.querySelector('span').textContent = t('acct.signIn');
      btn.addEventListener('click', signIn);
      slot.append(btn);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'acct-avatar';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', String(menuOpen));
    btn.setAttribute('aria-label', `${t('acct.menu')}: ${user.email}`);
    btn.title = user.email;
    if (user.avatarUrl) {
      const img = document.createElement('img');
      img.src = user.avatarUrl;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      btn.append(img);
    } else btn.textContent = (user.name || user.email).trim().charAt(0).toUpperCase();
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuOpen = !menuOpen;
      render();
    });
    slot.append(btn);
    if (!menuOpen) return;

    const menu = document.createElement('div');
    menu.className = 'acct-menu';
    menu.setAttribute('role', 'menu');
    const head = document.createElement('div');
    head.className = 'acct-who';
    head.innerHTML = '<b></b><span></span>';
    head.querySelector('b').textContent = user.name ?? '';
    head.querySelector('span').textContent = user.email;
    menu.append(head);
    const item = (label, onClick, href) => {
      const el = document.createElement(href ? 'a' : 'button');
      el.className = 'acct-item';
      el.setAttribute('role', 'menuitem');
      el.textContent = label;
      if (href) el.href = href;
      else el.type = 'button';
      el.addEventListener('click', () => {
        menuOpen = false;
        render();
        onClick?.();
      });
      menu.append(el);
    };
    for (const m of menuItems()) item(m.label, m.onClick);
    if (admin) item(t('acct.admin'), null, '/admin.html');
    item(t('acct.signOut'), () => backend.signOut().catch(() => toast(t('acct.offline'), 'error')));
    menu.addEventListener('click', (e) => e.stopPropagation());
    slot.append(menu);
  }

  document.addEventListener('click', () => {
    if (!menuOpen) return;
    menuOpen = false;
    render();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) {
      menuOpen = false;
      render();
    }
  });

  backend.onAuthChange(async (user) => {
    admin = false;
    menuOpen = false;
    if (user) await afterSignIn(user);
    render();
    for (const fn of listeners) fn(user);
  });
  if (backend.user()) await afterSignIn(backend.user());
  render();
  return api;
}
