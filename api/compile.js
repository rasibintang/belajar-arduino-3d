// Fungsi Vercel: POST /api/compile { sketch } -> { ok, hex, lines, stderr }
// Toolchain Arduino (.vercel-toolchain) dipasang & dirampingkan saat build (npm run vercel-build)
// dan ikut dalam fungsi ini lewat "includeFiles" di vercel.json.
import { handleCompile } from '../server/compile.mjs';

export const config = { maxDuration: 60 };

export default function handler(req, res) {
  return handleCompile(req, res);
}
