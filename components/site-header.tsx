"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, ShieldCheck, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  ["How it works", "/how-it-works"],
  ["Our intelligence", "/intelligence"],
  ["News & updates", "/news"],
  ["Report a site", "/report-site"],
  ["Consultancy", "/consultancy"],
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="Trade Shield Africa home">
        <span className="wordmark-icon"><ShieldCheck size={20} /></span>
        <span>TRADE<span className="wordmark-light">SHIELD</span><small>AFRICA</small></span>
      </Link>
      <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={21} /> : <Menu size={21} />}
      </button>
      <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
        {links.map(([label, href]) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>
        ))}
        <Link className="nav-account" href="/account" onClick={() => setMenuOpen(false)}>Create account</Link>
        <Link className="nav-cta" href="/#assessment" onClick={() => setMenuOpen(false)}>Check a website <ArrowRight size={15} /></Link>
      </nav>
      <ThemeToggle />
    </header>
  );
}