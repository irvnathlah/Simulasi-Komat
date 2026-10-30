import type { Metadata } from 'next';
import './globals.css';
import 'katex/dist/katex.min.css';
import { Header } from '@/components/layout/header';
export const metadata: Metadata = { title:'MGMP Matematika — Ruang Berlatih',description:'Ruang simulasi Olimpiade Matematika MGMP Kelas VII.' };
export default function Layout({children}:{children:React.ReactNode}){return <html lang="id"><body><a className="skip-link" href="#main">Lewati ke konten</a><div className="shell"><Header/>{children}<footer><span>MGMP MATEMATIKA <span className="footer-dot">✦</span> KELAS VII</span><span>Ruang berlatih. Bukan ujian atau sertifikasi resmi.</span></footer></div></body></html>}
