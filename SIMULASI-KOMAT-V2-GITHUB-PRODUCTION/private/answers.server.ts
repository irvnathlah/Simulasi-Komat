import 'server-only';
import data from './answer-key.json';
// Khusus backend/administrator. Tidak boleh dikirim melalui API/HTML/PDF siswa.
export const validatedAnswers = data;
