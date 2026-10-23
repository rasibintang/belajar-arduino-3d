/**
 * Sinkron progres pelajaran (daftar id pelajaran yang selesai) antara browser dan akun:
 * gabungan kedua sisi, tidak pernah menghapus. Gagal mengambil dari akun → progres lokal tidak
 * disentuh dan AccountError diteruskan ke pemanggil.
 * store: { allDone(): string[], mergeDone(ids): boolean } (lihat src/ui/store.js)
 */
export async function syncProgress(backend, store) {
  const remote = await backend.progress.pull();
  const local = new Set(store.allDone());
  const added = remote.filter((id) => !local.has(id)).length;
  store.mergeDone(remote);
  await backend.progress.push(store.allDone());
  return { added };
}
