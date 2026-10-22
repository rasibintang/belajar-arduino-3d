// Server kompilasi mandiri untuk produksi.
//   node server/compile-server.mjs        (port 8787, atau PORT=…)
// Frontend memanggilnya lewat VITE_COMPILE_URL saat build.

import { createServer } from 'node:http';
import { handleCompile } from './compile.mjs';

const port = Number(process.env.PORT ?? 8787);

createServer((req, res) => {
  if (req.url.startsWith('/api/compile')) return handleCompile(req, res);
  if (req.url === '/health') return res.end('ok');
  res.statusCode = 404;
  res.end();
}).listen(port, () => console.log(`Server kompilasi siap di http://localhost:${port}/api/compile`));
