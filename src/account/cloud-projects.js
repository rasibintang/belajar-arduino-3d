// Proyek sandbox di akun. Proyek lokal = { name, sketch, diagram, eeprom, cloudId? };
// cloudId hanya ada bila proyek itu milik pengguna yang sedang masuk, sehingga simpan otomatis
// tidak pernah menulis ke proyek orang lain (salinan pengelola tidak membawa cloudId).

const fields = ({ name, sketch, diagram, eeprom }) => ({ name, sketch, diagram, eeprom: eeprom ?? null });

/** Simpan ke akun: baru bila belum punya cloudId, perbarui bila sudah. → proyek dengan cloudId */
export async function saveToAccount(backend, project) {
  const { id } = await backend.projects.save({ ...fields(project), id: project.cloudId });
  return { ...project, cloudId: id };
}

/**
 * Buka proyek dari akun. copy: true → salinan tanpa cloudId (mis. pengelola membuka milik pengguna);
 * copyName(name) memberi nama salinan.
 */
export async function openFromAccount(backend, id, { copy = false, copyName = (name) => name } = {}) {
  const p = await backend.projects.get(id);
  const project = fields(p);
  if (copy) return { ...project, name: copyName(p.name) };
  return { ...project, cloudId: p.id };
}

/**
 * Simpan otomatis ke akun setelah jeda. Hanya proyek ber-cloudId; gagal → onError sekali per
 * rangkaian kegagalan (setelah berhasil lagi bisa melapor lagi). Tidak pernah melempar.
 */
export function createAutosave(backend, { delayMs = 2000, onError = () => {}, onSaved = () => {} } = {}) {
  let pending = null;
  let timer = null;
  let running = Promise.resolve();
  let failing = false;

  function run() {
    clearTimeout(timer);
    timer = null;
    const project = pending;
    pending = null;
    if (!project?.cloudId) return running;
    running = running.then(async () => {
      try {
        await backend.projects.save({ ...fields(project), id: project.cloudId });
        failing = false;
        onSaved(project);
      } catch (err) {
        if (!failing) onError(err);
        failing = true;
      }
    });
    return running;
  }

  return {
    schedule(project) {
      pending = project;
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    /** Simpan sekarang yang masih menunggu (mis. sebelum menutup halaman). */
    flush: () => run(),
  };
}
