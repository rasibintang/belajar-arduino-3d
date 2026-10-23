// Penyimpanan kecil di browser (progres, pengaturan, parameter pelajaran).
// Semua akses dibungkus try/catch: mode privat bisa menolak localStorage.

const KEY = 'learn-arduino:v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

const data = Object.assign({ done: [], settings: {}, params: {}, lesson: 0 }, load());
const doneListeners = new Set();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* abaikan */
  }
}

export const store = {
  isDone: (id) => data.done.includes(id),
  markDone(id) {
    if (!data.done.includes(id)) {
      data.done.push(id);
      save();
      for (const fn of doneListeners) fn(id);
      return true;
    }
    return false;
  },
  allDone: () => [...data.done],
  /** Tambahkan progres dari akun (gabungan, tidak pernah menghapus). → ada yang bertambah? */
  mergeDone(ids) {
    const before = data.done.length;
    for (const id of ids) if (!data.done.includes(id)) data.done.push(id);
    if (data.done.length === before) return false;
    save();
    return true;
  },
  /** Dipanggil setiap ada pelajaran yang baru selesai. */
  onDone(fn) {
    doneListeners.add(fn);
    return () => doneListeners.delete(fn);
  },
  doneCount: () => data.done.length,
  resetProgress() {
    data.done = [];
    data.params = {};
    save();
  },

  get lesson() {
    return data.lesson;
  },
  set lesson(i) {
    data.lesson = i;
    save();
  },

  setting(name, fallback) {
    return name in data.settings ? data.settings[name] : fallback;
  },
  setSetting(name, value) {
    data.settings[name] = value;
    save();
  },

  params: (id) => data.params[id] ?? {},
  saveParams(id, params) {
    data.params[id] = params;
    save();
  },
};
