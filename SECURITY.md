# Security policy · Kebijakan keamanan

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through
GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting).
Include the steps to reproduce and the affected page or endpoint. You will get a reply as soon as
possible, and a fix is released before the details are made public.

## Melaporkan kerentanan

Mohon **jangan membuka issue publik** untuk masalah keamanan. Laporkan secara privat lewat GitHub:
**Security → Report a vulnerability** di repositori ini. Sertakan langkah untuk mereproduksi dan
halaman atau endpoint yang terdampak. Laporan akan dibalas secepatnya, dan perbaikan dirilis
sebelum detailnya dibuka ke publik.

## Scope · Cakupan

- Live site / situs: https://learn-arduino-id.vercel.app
- Secrets (Supabase service role, AI provider keys) live only in Vercel environment variables and are
  never committed. Kunci rahasia hanya ada di variabel lingkungan Vercel, tidak pernah di-commit.
