# Simulasi KOMAT CBT v2

Next.js + Supabase; 30 soal, 120 menit, skor +4/0/0.

## Vercel

Unggah isi folder ini ke root repositori privat. Preset Next.js; Root Directory `./`; install `npm ci`; build `npm run build`; Output Directory default. Gunakan Node.js 24.x.

Environment server wajib: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `KOMAT_SESSION_SECRET`. Pertahankan secret sesi yang sama. Jangan gunakan awalan NEXT_PUBLIC_ untuk secret.

Origin deployment Vercel dikenali melalui environment Vercel. Untuk domain tambahan, isi `KOMAT_ALLOWED_ORIGINS` dengan origin HTTPS persis, dipisahkan koma; tanpa wildcard.

Migrasi database 001 dan 002 harus sudah diterapkan. Paket ini hanya untuk deployment aplikasi; pengujian, migrasi dan laporan pengembangan tetap berada di source utama.

Kunci/pembahasan berada di server; jangan pindahkan ke public atau membagikan source kepada peserta.
