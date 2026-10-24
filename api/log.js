// Fungsi Vercel: POST /api/log { events, metrics } — laporan pemantauan dari browser (server/log.mjs).
import { handleLog } from '../server/log.mjs';

export default function handler(req, res) {
  return handleLog(req, res);
}
