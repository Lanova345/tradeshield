"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CreditCard, FileSearch, Fingerprint, Globe2, Menu, Radar, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const stages = [
  {
    number: "01",
    icon: Globe2,
    title: "Submit the website address",
    description: "Provide the trading platform's public website URL. The address is validated before an assessment can be requested.",
    detail: "Submit the exact public domain. Do not enter passwords, one-time codes, or private account links.",
  },
  {
    number: "02",
    icon: CreditCard,
    title: "Confirm the scope and fee",
    description: "A one-time USD 4 fee covers one website assessment. Analysis begins only after payment has been verified.",
    detail: "There is no recurring subscription. Entering a URL does not initiate a charge.",
  },
  {
    number: "03",
    icon: FileSearch,
    title: "Collect available evidence",
    description: "The assessment reviews accessible site content and technical details, including domain, DNS, connection security, and supported threat-reputation sources.",
    detail: "Unavailable sources are reported as coverage limitations, not interpreted as clean results.",
  },
  {
    number: "04",
    icon: Radar,
    title: "Assess findings in context",
    description: "The risk engine evaluates observed signals together. A separate confidence assessment indicates how much supporting evidence is available.",
    detail: "The resulting score is an information aid, not a regulatory finding or proof of fraud.",
  },
  {
    number: "05",
    icon: Fingerprint,
    title: "Review the report and verify claims",
    description: "Review the summary, risk level, confidence, individual findings, and available source details. Use them to guide further due diligence.",
    detail: "Verify claimed authorization with the relevant official regulator and confirm the entity, domain, and service match.",
  },
];

const reportItems = [
  [ShieldAlert, "Risk score and level", "A structured assessment of observed signals; not a certification of safety."],
  [BadgeCheck, "Confidence and summary", "An indication of evidence strength and an AI-assisted explanation of findings."],
  [FileSearch, "Sourced findings", "Specific observations with source details where available."],
  [Radar, "Coverage limitations", "Unavailable checks are identified so missing data is not mistaken for reassurance."],
];

export default function HowItWorksPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="how-page">
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Trade Shield Africa home">
          <span className="wordmark-icon"><ShieldCheck size={20} /></span>
          <span>TRADE<span className="wordmark-light">SHIELD</span><small>AFRICA</small></span>
        </Link>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
          <Link className="nav-how" href="/how-it-works" aria-current="page" onClick={() => setMenuOpen(false)}>How it works</Link>
          <Link href="/intelligence" onClick={() => setMenuOpen(false)}>Our intelligence</Link>
          <Link href="/news" onClick={() => setMenuOpen(false)}>News &amp; updates</Link>
          <Link href="/report-site" onClick={() => setMenuOpen(false)}>Report a site</Link>
          <Link href="/consultancy" onClick={() => setMenuOpen(false)}>Consultancy</Link>
          <Link className="nav-account" href="/account" onClick={() => setMenuOpen(false)}>Create account</Link>
          <Link className="nav-cta" href="/#assessment" onClick={() => setMenuOpen(false)}>Check a website <ArrowRight size={15} /></Link>
        </nav>
        <ThemeToggle />
      </header>

      <section className="how-hero">
        <div className="how-hero-copy">
          <span className="how-eyebrow"><span /> THE ASSESSMENT PROCESS</span>
          <h1>From website address to <em>evidence-led</em> assessment.</h1>
          <p>Trade Shield is designed to assess publicly available website and technical signals, then present the findings with source and confidence context to support your due diligence.</p>
          <div className="how-hero-actions">
            <Link className="button button-lime" href="/#assessment">View assessment <ArrowRight size={16} /></Link>
            <span className="how-price-chip"><strong>USD 4</strong><span>one-time fee / one website</span></span>
          </div>
        </div>
        <aside className="how-hero-aside">
          <span className="how-aside-label">THE PRINCIPLE</span>
          <strong>Evidence-led review.<br />Your decision.</strong>
          <p>The assessment organizes available information. Investment decisions remain yours.</p>
        </aside>
      </section>

      <section className="how-flow-section" aria-labelledby="flow-title">
        <div className="how-section-heading">
          <span className="how-kicker">01 / FROM URL TO REPORT</span>
          <h2 id="flow-title">A clear five-step process.</h2>
          <p>Each stage is designed to make the assessment scope, evidence, and limitations clear.</p>
        </div>
        <ol className="how-flow-list">
          {stages.map(({ number, icon: Icon, title, description, detail }) => (
            <li className="how-flow-step" key={number}>
              <span className="how-flow-number">{number}</span>
              <span className="how-flow-icon"><Icon size={18} /></span>
              <div className="how-flow-content">
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="how-flow-detail">{detail}</span>
              </div>
              {number !== "05" && <span className="how-flow-connector" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </section>

      <section className="how-report-section" aria-labelledby="report-title">
        <div className="how-section-heading">
          <span className="how-kicker">02 / WHAT YOU RECEIVE</span>
          <h2 id="report-title">A report you can review.</h2>
          <p>The one-time USD 4 assessment is designed to provide a sourced starting point for further due diligence.</p>
        </div>
        <div className="how-report-list">
          {reportItems.map(([Icon, title, description], index) => {
            const ReportIcon = Icon;
            return (
              <article className="how-report-item" key={title as string}>
                <span className="how-report-index">0{index + 1}</span>
                <ReportIcon size={19} />
                <div><h3>{title as string}</h3><p>{description as string}</p></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="how-preview-notice" aria-labelledby="preview-title">
        <div className="how-notice-icon"><ShieldAlert size={19} /></div>
        <div>
          <span className="how-kicker">PAYMENT AND ASSESSMENT</span>
          <h2 id="preview-title">Pay with M-Pesa, then review the evidence.</h2>
          <p>Sign in or create an account to request a website assessment. Approve the M-Pesa prompt, and the scan will begin after payment is confirmed.</p>
          <Link className="how-notice-link" href="/intelligence">Review the assessment signals <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="how-caution-section">
        <div><span className="how-kicker">03 / IMPORTANT INFORMATION</span><h2>An assessment informs due diligence; it does not guarantee an outcome.</h2></div>
        <div className="how-caution-copy"><p>A low-risk result does not establish that a platform is legitimate. An individual warning signal does not, on its own, establish fraud. Source information may be incomplete, change over time, or be unavailable.</p><p>Before transferring funds, verify the business identity, authorization, website domain, and payment instructions using independent official sources. Trade Shield is not a regulator or investment adviser.</p></div>
      </section>

      <footer className="site-footer how-footer">
        <div className="footer-main">
          <Link className="wordmark" href="/"><span className="wordmark-icon"><ShieldCheck size={20} /></span><span>TRADE<span className="wordmark-light">SHIELD</span><small>AFRICA</small></span></Link>
          <p>Check before you deposit.<br />A little more clarity for a high-stakes decision.</p>
          <Link className="footer-check" href="/intelligence">Our intelligence <ArrowRight size={15} /></Link>
        </div>
        <div className="footer-bottom"><span>COPYRIGHT 2026 TRADE SHIELD AFRICA</span><span>TECHNOLOGY-ASSISTED DIGITAL RISK INFORMATION</span><Link href="/#disclaimer">IMPORTANT INFORMATION <ArrowRight size={12} /></Link></div>
        <p className="footer-credit">Powered by Aura Stack Intelligence Systems | New York, USA</p>
      </footer>
    </main>
  );
}