import Link from 'next/link';
import { ArrowUpRight, GraduationCap } from 'lucide-react';
export function Header(){ return <header className="header"><Link className="brand" href="/" aria-label="MGMP Matematika, beranda"><span className="brand-icon"><GraduationCap size={26}/></span><span>MGMP<span className="brand-sub">MATEMATIKA · KELAS VII</span></span></Link><nav aria-label="Navigasi utama"><Link href="/petunjuk">Panduan simulasi <ArrowUpRight size={16}/></Link><span className="simulation-badge">SIMULASI</span></nav></header> }
