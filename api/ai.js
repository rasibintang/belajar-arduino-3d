// Fungsi Vercel: POST /api/ai { prompt, lang, mode, current? } → rangkaian dari AI (lihat server/ai.mjs);
// GET /api/ai → { enabled, provider, label }. Kunci penyedia AI dan service role Supabase dibaca dari
// variabel lingkungan Vercel (tanpa awalan VITE_), tidak pernah dikirim ke browser.
import { handleAi } from '../server/ai.mjs';

export const config = { maxDuration: 60 };

export default function handler(req, res) {
  return handleAi(req, res);
}
