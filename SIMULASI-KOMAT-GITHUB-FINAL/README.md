# MGMP Mathematics Olympiad CBT — Phase 4 release candidate

Latihan mandiri Kelas VII dengan 30 soal asli, timer deadline 120 menit, autosave, pembahasan dan PDF. Identitas tepat dua isian wajib: **Nama Lengkap** dan **Asal Sekolah**. Penilaian final: benar +4, salah 0, kosong 0 (nilai 0–120). Cerita soal 1 tetap menggunakan aturan matematikanya sendiri; keputusan soal 4 dipertahankan.

## Jalankan lokal

Gunakan Node.js 24.x (runtime QA; kebutuhan Next minimal 20.9):

```powershell
npm ci
npm run dev
```

Buka http://127.0.0.1:3000. Untuk versi produksi lokal:

```powershell
npm run build
npm start
```

Tidak ada env wajib, login, database atau layanan berbayar. Web Locks wajib di localhost/HTTPS. Pakai satu tab ujian; tab kedua ditolak. Timer dimulai hanya setelah Mulai Ujian. Semua timestamp laporan memakai Asia/Jakarta.

## Verifikasi

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

Playwright memakai build produksi yang sudah dibuat. Matrix lima profil mencakup Chromium/Firefox/WebKit desktop dan emulasi Chromium/WebKit mobile. Tes waktu memakai controlled clock. Hasil aktual: docs/QA_PHASE4.md. Semua dependency terkunci di package-lock.json; KaTeX patched 0.18.2.

## Pemulihan dan privasi

Sesi Phase 3 yang berisi data nomor peserta diparse tanpa nomor; UUID, deadline dan jawaban tetap. Bila sekolah/nama belum ada, formulir migrasi meminta hanya nilai yang kosong tanpa reset waktu. Identitas sesi baru tidak bisa diedit setelah mulai. Restart meminta konfirmasi dan mengganti percobaan lama; unduh laporan lebih dahulu.

Storage gagal ditampilkan eksplisit. Clock/storage browser bukan anti manipulasi dan recovery tidak dijamin ketika storage terus gagal. API hasil memvalidasi schema/state, bukan bukti server-authoritative. Paket source memuat kunci penyusun di private dan tidak boleh dibagikan utuh ke peserta. Jangan memakai simulasi ini sebagai ujian resmi berintegritas tinggi.

## Dokumentasi rilis

- docs/QA_PHASE4.md — pemeriksaan aktual dan batas.
- docs/PHASE4_UI_UX_REVIEW.md — perbaikan UI dan semua diagram.
- docs/PHASE4_ACCESSIBILITY_REPORT.md — keyboard, fokus, timer, kontras dan batas audit.
- docs/PHASE4_RELEASE_CHECKLIST.md — status lokal/publik/resmi dan persiapan Vercel opsional.
- docs/PHASE3_ARCHITECTURE.md — arsitektur dasar dengan addendum Phase 4 yang mengganti model identitas lama.
- docs/SCORING_VALIDATION.md — aturan dan tujuh skenario nilai final.

Dokumen fase lama adalah catatan historis. Tidak ada deployment dan tidak ada Phase 5 pada pekerjaan ini.
