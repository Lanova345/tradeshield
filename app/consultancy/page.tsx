"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Fingerprint, Menu, ShieldCheck, X } from "lucide-react";
import { ConsultancyForm } from "@/components/consultancy-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ConsultancyPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="consultancy-page">
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Trade Shield Africa home">
          <span className="wordmark-icon"><ShieldCheck size={20} /></span>
          <span>TRADE<span className="wordmark-light">SHIELD</span><small>AFRICA</small></span>
        </Link>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
          <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>How it works</Link>
          <Link href="/intelligence" onClick={() => setMenuOpen(false)}>Our intelligence</Link>
          <Link href="/news" onClick={() => setMenuOpen(false)}>News &amp; updates</Link>
          <Link href="/report-site" onClick={() => setMenuOpen(false)}>Report a site</Link>
          <Link className="nav-consultancy" href="/consultancy" aria-current="page" onClick={() => setMenuOpen(false)}>Consultancy</Link>
          <Link className="nav-account" href="/account" onClick={() => setMenuOpen(false)}>Create account</Link>
          <Link className="nav-cta" href="/#assessment" onClick={() => setMenuOpen(false)}>Check a website <ArrowRight size={15} /></Link>
        </nav>
        <ThemeToggle />
      </header>

      <section className="consultancy-page-hero">
        <div className="consultancy-page-copy">
          <span className="section-kicker">WHEN A CLOSER LOOK HELPS</span>
          <h1>Digital risk, with a <em>human lens.</em></h1>
          <p>Bring us a question about investment due diligence, trading-platform verification, or corporate digital risk. Share the context you can safely provide and request a focused consultation.</p>
          <div className="consultancy-page-price"><strong>USD 16</strong><span>one-time consultation</span></div>
        </div>
        <aside className="consultancy-page-scope">
          <span className="consultancy-page-scope-icon"><Fingerprint size={20} /></span>
          <span className="consultancy-page-scope-label">POSSIBLE AREAS OF REVIEW</span>
          <ul>
            <li><ShieldCheck size={16} /><span>Trading-platform identity and public claims</span></li>
            <li><Building2 size={16} /><span>Investment due-diligence questions</span></li>
            <li><Fingerprint size={16} /><span>Corporate digital-risk concerns</span></li>
          </ul>
          <p>Consultancy supports your review; it is not legal, regulatory, or investment advice.</p>
        </aside>
      </section>

      <section className="consultancy-section consultancy-page-form" aria-labelledby="consultancy-form-title">
        <div className="consultancy-copy">
          <span className="section-kicker">START A CONSULTATION</span>
          <h2 id="consultancy-form-title">What would you like reviewed?</h2>
          <p>Describe the question or public information you would like our team to consider. Do not include passwords, account numbers, or one-time codes.</p>
        </div>
        <ConsultancyForm />
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <Link className="wordmark" href="/"><span className="wordmark-icon"><ShieldCheck size={20} /></span><span>TRADE<span className="wordmark-light">SHIELD</span><small>AFRICA</small></span></Link>
          <p>Check before you deposit.<br />A little more clarity for a high-stakes decision.</p>
          <Link className="footer-check" href="/">Back to Trade Shield <ArrowRight size={15} /></Link>
        </div>
        <div className="footer-bottom"><span>COPYRIGHT 2026 TRADE SHIELD AFRICA</span><span>TECHNOLOGY-ASSISTED DIGITAL RISK INFORMATION</span><Link href="/#disclaimer">IMPORTANT INFORMATION <ArrowRight size={12} /></Link></div>
        <p className="footer-credit">Powered by Aura Stack Intelligence Systems | New York, USA</p>
        <p className="disclaimer">Trade Shield provides technology-assisted digital risk assessment and consultancy information. Consultancy is not legal, regulatory, or investment advice. Independently verify authorization, identity, ownership, and payment instructions before transferring funds.</p>
      </footer>
    </main>
  );
}