"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, BadgeAlert, Building2, Eye, Fingerprint, Globe2, Menu, Radar, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const warningSignals = [
  {
    number: "01",
    title: "Guaranteed or unusually high returns",
    description: "No legitimate trading strategy can remove market risk. Treat certainty, fixed profits, or “risk-free” claims as reasons to slow down and verify.",
    icon: BadgeAlert,
  },
  {
    number: "02",
    title: "Pressure to act or keep it secret",
    description: "Countdowns, personal pressure, and requests to move the conversation off-platform make independent checks harder. Take time before sending funds.",
    icon: Eye,
  },
  {
    number: "03",
    title: "Unexpected fees to release a withdrawal",
    description: "A demand for more money to unlock an account or release supposed profits is a serious warning. Do not pay more until you have verified it independently.",
    icon: ShieldAlert,
  },
  {
    number: "04",
    title: "A company or licence claim that does not add up",
    description: "Names, registration details, website domains, and the service offered should agree. Check any claimed authorization directly with the relevant official source.",
    icon: Building2,
  },
];

const reviewAreas = [
  [Globe2, "Domain & infrastructure", "Domain age and DNS details can add context about a website's footprint. Newness alone does not establish fraud."],
  [ShieldCheck, "Site security", "TLS and security-header observations help describe the connection and site setup. A secure connection does not prove a business is legitimate."],
  [Radar, "Threat reputation", "Available independent reputation sources may show known threat matches. Coverage differs and a clean result is not a safety guarantee."],
  [Fingerprint, "Public claims & identity", "Public website content and identity claims can be compared for inconsistencies and claims that deserve independent verification."],
];

export default function IntelligencePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="intelligence-page">
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
          <Link className="nav-intelligence" href="/intelligence" aria-current="page" onClick={() => setMenuOpen(false)}>Our intelligence</Link>
          <Link href="/news" onClick={() => setMenuOpen(false)}>News &amp; updates</Link>
          <Link href="/report-site" onClick={() => setMenuOpen(false)}>Report a site</Link>
          <Link href="/consultancy" onClick={() => setMenuOpen(false)}>Consultancy</Link>
          <Link className="nav-account" href="/account" onClick={() => setMenuOpen(false)}>Create account</Link>
          <Link className="nav-cta" href="/#assessment" onClick={() => setMenuOpen(false)}>Check a website <ArrowRight size={15} /></Link>
        </nav>
        <ThemeToggle />
      </header>

      <section className="intel-hero">
        <div className="intel-hero-copy">
          <span className="intel-eyebrow"><span /> TRADING RISK / KENYA</span>
          <h1>Spot the warning signs <em>before</em> you send money.</h1>
          <p>Trade Shield helps you examine a trading website through technical signals, public claims, threat-reputation context, and relevant Kenyan regulatory information.</p>
          <div className="intel-hero-actions">
            <Link className="button button-lime" href="/#assessment">Check a website <ArrowRight size={16} /></Link>
            <a className="intel-text-link" href="#how-to-use">How to use the findings <ArrowDown size={15} /></a>
          </div>
        </div>
        <aside className="intel-hero-note" aria-label="Important assessment limitation">
          <span className="intel-note-icon"><ShieldCheck size={19} /></span>
          <span className="intel-note-label">DECISION SUPPORT, NOT A VERDICT</span>
          <p>A risk assessment can help you find questions to ask. It cannot certify a site as safe or prove that it is a scam.</p>
          <span className="intel-note-rule" />
          <span className="intel-note-foot">REVIEW EVIDENCE. VERIFY INDEPENDENTLY.</span>
        </aside>
      </section>

      <section className="intel-warning-section" aria-labelledby="warning-title">
        <div className="intel-section-intro">
          <span className="intel-kicker">01 / SPOT THE PATTERN</span>
          <h2 id="warning-title">Scams often rely on pressure, promises, and confusion.</h2>
          <p>These behaviors are reasons to pause and investigate. None, by itself, confirms that a website is fraudulent.</p>
        </div>
        <div className="intel-warning-list">
          {warningSignals.map(({ number, title, description, icon: Icon }) => (
            <article className="intel-warning-row" key={number}>
              <span className="intel-warning-number">{number}</span>
              <span className="intel-warning-icon"><Icon size={18} /></span>
              <div><h3>{title}</h3><p>{description}</p></div>
              <ArrowRight className="intel-warning-arrow" size={17} aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className="intel-review-section" aria-labelledby="review-title">
        <div className="intel-section-intro">
          <span className="intel-kicker">02 / WHAT THE CONSOLE REVIEWS</span>
          <h2 id="review-title">More context. Fewer blind spots.</h2>
          <p>Signals are considered together and shown with source and confidence context where available. Missing data stays a limitation, not an accusation.</p>
        </div>
        <div className="intel-review-grid">
          {reviewAreas.map(([Icon, title, description], index) => {
            const ReviewIcon = Icon;
            return (
              <article className="intel-review-item" key={title as string}>
                <div className="intel-review-top"><span>0{index + 1}</span><ReviewIcon size={19} /></div>
                <h3>{title as string}</h3>
                <p>{description as string}</p>
              </article>
            );
          })}
        </div>
        <div className="intel-regulatory-note"><Building2 size={17} /><p>Regulatory checks depend on what service the platform claims to offer. CMA, CBK, SASRA, or another authority may be relevant; verify a licence with the official regulator directly. Trade Shield is not a regulator.</p></div>
      </section>

      <section className="intel-price-section" aria-labelledby="price-title">
        <div className="intel-price-copy">
          <span className="intel-kicker">ONE WEBSITE / ONE ASSESSMENT</span>
          <h2 id="price-title">A clearer picture before a bigger decision.</h2>
          <p>Before moving a larger amount into an unfamiliar trading platform, spend USD 4 on a focused review of the website and the public signals available about it.</p>
          <div className="intel-price-value"><strong>USD 4</strong><span>one-time assessment<br />for one website</span></div>
        </div>
        <div className="intel-price-deliverables">
          <span className="intel-price-label">WHAT THE ASSESSMENT IS DESIGNED TO PROVIDE</span>
          <ul>
            <li><ShieldCheck size={16} /><span>A risk score and confidence level, with an AI-assisted plain-language summary.</span></li>
            <li><Globe2 size={16} /><span>Observed domain, DNS, TLS, and website-security signals.</span></li>
            <li><Radar size={16} /><span>Available threat-reputation checks and their provider/source context.</span></li>
            <li><Fingerprint size={16} /><span>Public-page claims and identity signals that may deserve follow-up.</span></li>
          </ul>
          <p className="intel-price-caveat">The report is a due-diligence aid, not a certification of legitimacy or a promise that you will avoid loss. Provider data may be incomplete or unavailable.</p>
          <div className="intel-checkout-status" role="status"><span className="intel-status-dot" /><span><strong>Assessment access requires an account.</strong> After checkout is confirmed through M-Pesa, the scan runs and its evidence report appears on screen.</span></div>
          <Link className="intel-price-link" href="/#assessment">See the assessment flow <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="intel-how-section" id="how-to-use" aria-labelledby="use-title">
        <div className="intel-how-heading">
          <span className="intel-kicker">03 / BEFORE YOU DEPOSIT</span>
          <h2 id="use-title">Make the report your starting point.</h2>
          <p>A few deliberate checks can make it harder for a convincing website to rush your decision.</p>
        </div>
        <ol className="intel-steps">
          <li><span>01</span><div><h3>Review the evidence</h3><p>Look at what was observed, the source, when it was checked, and how confident the finding is.</p></div></li>
          <li><span>02</span><div><h3>Confirm the business</h3><p>Check the legal entity and any claimed authorization against official sources. Match the domain and service, not just a similar company name.</p></div></li>
          <li><span>03</span><div><h3>Keep control of your money</h3><p>Do not share passwords, one-time codes, or remote access. Avoid sending funds to personal accounts or paying extra to “unlock” withdrawals.</p></div></li>
          <li><span>04</span><div><h3>Pause when details conflict</h3><p>Contact your bank or payment provider promptly if you have already sent money. Keep messages and transaction records, and report concerns to the relevant authority.</p></div></li>
        </ol>
        <Link className="button button-lime intel-bottom-cta" href="/#assessment">Review a website <ArrowRight size={16} /></Link>
      </section>

      <footer className="site-footer intel-footer">
        <div className="footer-main">
          <Link className="wordmark" href="/"><span className="wordmark-icon"><ShieldCheck size={20} /></span><span>TRADE<span className="wordmark-light">SHIELD</span><small>AFRICA</small></span></Link>
          <p>Check before you deposit.<br />A little more clarity for a high-stakes decision.</p>
          <Link className="footer-check" href="/#assessment">Check a website <ArrowRight size={15} /></Link>
        </div>
        <div className="footer-bottom"><span>COPYRIGHT 2026 TRADE SHIELD AFRICA</span><span>TECHNOLOGY-ASSISTED DIGITAL RISK INFORMATION</span><Link href="/#disclaimer">IMPORTANT INFORMATION <ArrowRight size={12} /></Link></div>
        <p className="footer-credit">Powered by Aura Stack Intelligence Systems | New York, USA</p>
        <p className="disclaimer">A risk score is not a definitive legal determination that a website or entity is fraudulent or legitimate. Information may be incomplete, outdated, or unavailable. Independently verify authorization, identity, ownership, and payment instructions before transferring funds.</p>
      </footer>
    </main>
  );
}