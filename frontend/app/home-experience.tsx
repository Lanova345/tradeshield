"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowDownRight, ArrowRight, ChevronDown, Fingerprint, Globe2, Menu, MessageCircle, Radar, Send, ShieldAlert, ShieldCheck, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConsultancyForm } from "@/components/consultancy-form";
import { API_BASE_URL } from "@/lib/site-api";

const checklist = ["Domain & DNS", "TLS & security", "Threat reputation", "Site content"];
const faqs = [
  ["Does a high score prove a website is a scam?", "No. A score is an internal risk indicator based on available evidence, not a legal finding. We show the signals, their sources and uncertainty so you can make an informed decision."],
  ["Do you verify every investment company with CMA?", "We first consider the service a website claims to provide. CMA checks are relevant to certain capital-markets services; other services may fall under different regulators or no licensing requirement."],
  ["Is my submitted website opened safely?", "Production scans must use server-side fetching with DNS/IP checks, redirect limits, timeouts and response caps. This preview does not fetch submitted URLs or make a safety determination."],
];
function normalizeWebsite(value: string) {
  const candidate = value.trim().includes("://") ? value.trim() : `https://${value.trim()}`;
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes(".")) throw new Error("Enter a full website address, such as example.com.");
  return parsed;
}

function NeuralNetworkOverlay({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const activeCanvas = canvas as HTMLCanvasElement;
    const drawingContext = context as CanvasRenderingContext2D;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let points: { x: number; y: number; phase: number }[] = [];

    function pointPosition(point: { x: number; y: number; phase: number }, time: number) {
      return {
        x: point.x + Math.sin(time * 0.7 + point.phase) * 3,
        y: point.y + Math.cos(time * 0.55 + point.phase) * 3,
      };
    }

    function draw(time: number) {
      drawingContext.clearRect(0, 0, width, height);
      const seconds = time / 1000;
      const positions = points.map((point) => pointPosition(point, seconds));

      for (let first = 0; first < positions.length; first += 1) {
        for (let second = first + 1; second < positions.length; second += 1) {
          const start = positions[first];
          const end = positions[second];
          const distance = Math.hypot(end.x - start.x, end.y - start.y);
          if (distance > 142) continue;

          drawingContext.beginPath();
          drawingContext.moveTo(start.x, start.y);
          drawingContext.lineTo(end.x, end.y);
          drawingContext.strokeStyle = `rgba(117, 230, 220, ${(1 - distance / 142) * 0.2})`;
          drawingContext.lineWidth = 1;
          drawingContext.stroke();

          if (!reducedMotion && (first * 13 + second * 7) % 17 === 0) {
            const progress = (seconds * 0.12 + (first + second) / 17) % 1;
            drawingContext.beginPath();
            drawingContext.arc(start.x + (end.x - start.x) * progress, start.y + (end.y - start.y) * progress, 2, 0, Math.PI * 2);
            drawingContext.fillStyle = "rgba(216, 255, 104, 0.9)";
            drawingContext.fill();
          }
        }
      }

      for (const point of positions) {
        drawingContext.beginPath();
        drawingContext.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
        drawingContext.fillStyle = "rgba(160, 240, 224, 0.72)";
        drawingContext.fill();
      }
    }

    function resize() {
      const bounds = activeCanvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = bounds.width;
      height = bounds.height;
      activeCanvas.width = Math.round(width * pixelRatio);
      activeCanvas.height = Math.round(height * pixelRatio);
      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const columns = Math.ceil(width / 125);
      const rows = Math.max(3, Math.ceil(height / 120));
      points = Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        return {
          x: ((column + 0.2 + Math.random() * 0.6) / columns) * width,
          y: ((row + 0.2 + Math.random() * 0.6) / rows) * height,
          phase: Math.random() * Math.PI * 2,
        };
      });
      draw(0);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(activeCanvas);
    resize();

    function animate(time: number) {
      draw(time);
      animationFrame = window.requestAnimationFrame(animate);
    }

    if (!reducedMotion) animationFrame = window.requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} className="hero-network" aria-hidden="true" />;
}

function getConsoleReply(question: string) {
  const text = question.toLowerCase();
  if (/price|cost|pay|payment|kes/.test(text)) {
    return "A website assessment is a one-time USD 4 charge, settled through the M-Pesa payment prompt. The scan starts after payment is confirmed.";
  }
  if (/scan|check|look at|analyse|analyze/.test(text)) {
    return "A completed assessment can review domain and DNS details, TLS and security headers, threat-reputation providers, and publicly visible site content. Findings include sources and limitations. This chat does not scan websites.";
  }
  if (/score|risk|safe|scam|fraud|result/.test(text)) {
    return "A risk score is an indicator based on observed evidence, not a legal finding or a guarantee that a site is safe. Review each source, confidence level, and limitation, then independently verify important claims.";
  }
  if (/license|licence|regulat|cma|cbk|sasra/.test(text)) {
    return "Regulatory checks depend on the service a platform claims to provide. A missing register match is a reason to verify with the relevant regulator, not proof of wrongdoing. Trade Shield is not a regulator.";
  }
  if (/url|website|link|address|private|privacy/.test(text)) {
    return "The address field checks URL format before a scan is requested. A production scan should fetch the site server-side with DNS/IP validation, redirect limits, timeouts, and response-size limits. Do not paste passwords or private account details here.";
  }
  return "I can explain what a scan checks, how risk scores work, regulatory context, and the assessment fee. I can’t assess a specific website or provide investment advice in this chat.";
}

function TSConsoleChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Welcome to TS CONSOLE. Ask me how website checks, evidence, risk scores, or payment work." },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [isOpen, messages]);

  function askConsole(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }, { role: "assistant", text: getConsoleReply(trimmed) }]);
    setQuestion("");
  }

  return <aside className="fixed bottom-4 left-4 z-60 md:bottom-5 md:left-5" aria-label="TS Console product help">
    {isOpen && <section className="absolute bottom-15.5 left-0 flex max-h-[min(560px,calc(100dvh-110px))] w-[min(370px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-emerald-950/15 bg-[#f8fbf9] shadow-2xl ring-1 ring-black/5" aria-label="Chat with TS Console">
      <header className="flex min-h-16 items-center gap-3 bg-[#102c29] px-4 py-3 text-[#f2f7f3]"><span className="grid size-9 place-items-center rounded-md border border-emerald-100/25 text-teal-200"><ShieldCheck size={17} /></span><div className="grid gap-0.5"><strong className="text-sm font-semibold">TS CONSOLE</strong><span className="text-[10px] font-semibold tracking-wide text-emerald-100/75">TRADING SHIELD GUIDE</span></div><button className="ml-auto grid size-9 place-items-center rounded-md border border-emerald-100/25 text-emerald-50 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200" type="button" aria-label="Close TS Console chat" onClick={() => setIsOpen(false)}><X size={18} /></button></header>
      <div className="flex min-h-30 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">{messages.map((message, index) => <div className={`flex max-w-[90%] ${message.role === "user" ? "self-end" : "self-start"}`} key={`${message.role}-${index}`}><span className={`rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed ${message.role === "user" ? "rounded-br-sm border-emerald-200 bg-emerald-50 text-emerald-950" : "rounded-bl-sm border-emerald-950/10 bg-white text-slate-700"}`}>{message.text}</span></div>)}<div ref={messagesEndRef} /></div>
      {messages.length === 1 && <div className="flex flex-wrap gap-2 px-4 pb-3"><button className="min-h-9 rounded-md border border-emerald-900/20 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" type="button" onClick={() => askConsole("What does a scan check?")}>What does a scan check?</button><button className="min-h-9 rounded-md border border-emerald-900/20 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" type="button" onClick={() => askConsole("How should I read a risk score?")}>How do risk scores work?</button></div>}
      <form className="flex gap-2 border-t border-emerald-950/10 bg-white p-3" onSubmit={(event) => { event.preventDefault(); askConsole(question); }}><label className="sr-only" htmlFor="ts-console-question">Ask TS Console</label><input className="min-h-11 min-w-0 flex-1 rounded-md border border-emerald-950/15 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15" id="ts-console-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this console..." /><button className="grid size-11 shrink-0 place-items-center rounded-md bg-[#123a34] text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" type="submit" aria-label="Send question" disabled={!question.trim()}><Send size={17} /></button></form>
      <p className="bg-white px-4 pb-3 text-[11px] leading-relaxed text-slate-600">Product guidance only. No live AI analysis or website scans in chat.</p>
    </section>}
    <button className={`flex min-h-12 items-center gap-2.5 rounded-md border border-emerald-800 bg-[#102c29] px-4 text-xs font-bold text-white shadow-lg shadow-emerald-950/25 transition hover:-translate-y-0.5 hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${isOpen ? "bg-emerald-900" : ""}`} type="button" aria-expanded={isOpen} aria-label={isOpen ? "Close TS Console help" : "Open TS Console help"} onClick={() => setIsOpen(!isOpen)}>{isOpen ? <X size={19} /> : <MessageCircle size={19} />}<span>TS CONSOLE</span><span className="ml-0.5 size-2 rounded-full bg-lime-300 shadow-[0_0_10px_rgba(216,255,104,0.5)]" /></button>
  </aside>;
}

export default function HomeExperience() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [website, setWebsite] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [message, setMessage] = useState("");
  const [assessmentReady, setAssessmentReady] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [needsAccount, setNeedsAccount] = useState(false);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  function validateWebsite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const parsed = normalizeWebsite(website);
      setWebsite(parsed.toString());
      setAssessmentReady(true);
      setPaymentError("");
      setNeedsAccount(false);
      setMessage("Address checked. No scan has been run.");
    } catch (error) {
      setAssessmentReady(false);
      setMessage(error instanceof Error ? error.message : "Enter a valid website address.");
    }
  }

  async function startWebsiteAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError("");
    setNeedsAccount(false);
    setIsStartingScan(true);

    try {
      const scanResponse = await fetch(`${API_BASE_URL}/scans`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website }),
      });
      if (scanResponse.status === 401) {
        setNeedsAccount(true);
        throw new Error("Sign in or create an account to request a website scan.");
      }
      const scanResult = await scanResponse.json().catch(() => null) as { id?: string; detail?: string } | null;
      if (!scanResponse.ok || !scanResult?.id) throw new Error(scanResult?.detail || "We could not create this assessment. Please try again.");

      const paymentResponse = await fetch(`${API_BASE_URL}/payments/initialize/${encodeURIComponent(scanResult.id)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mpesaPhone }),
      });
      const checkout = await paymentResponse.json().catch(() => null) as { reference?: string; status?: string; detail?: string } | null;
      if (!paymentResponse.ok) throw new Error(checkout?.detail || "We could not start M-Pesa checkout. Please try again.");
      if (!checkout?.reference || checkout.status !== "pay_offline") throw new Error("Paystack did not send an M-Pesa prompt.");
      router.push(`/payment/return?reference=${encodeURIComponent(checkout.reference)}`);
    } catch (requestError) {
      setPaymentError(requestError instanceof Error ? requestError.message : "We could not start this assessment. Please try again.");
    } finally {
      setIsStartingScan(false);
    }
  }

  const reveal = prefersReducedMotion ? {} : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 } };
  return <main>
    <header className="site-header"><a className="wordmark" href="#top" aria-label="Trade Shield Africa home"><span className="wordmark-icon"><ShieldCheck size={20} /></span><span>TRADE<span className="wordmark-light">SHIELD</span><small>AFRICA</small></span></a><button className="mobile-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button><nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation"><a href="/how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="/intelligence" onClick={() => setMenuOpen(false)}>Our intelligence</a><Link href="/news" onClick={() => setMenuOpen(false)}>News &amp; updates</Link><Link href="/report-site" onClick={() => setMenuOpen(false)}>Report a site</Link><a href="/consultancy" onClick={() => setMenuOpen(false)}>Consultancy</a><a className="nav-account" href="/account" onClick={() => setMenuOpen(false)}>Create account</a><a className="nav-cta" href="#assessment" onClick={() => setMenuOpen(false)}>Check a website <ArrowRight size={15} /></a></nav><ThemeToggle /></header>

    <section className="hero" id="top"><NeuralNetworkOverlay reducedMotion={prefersReducedMotion} /><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> TRADING SHIELD CONSOLE</div><h1>Africa digital risk <em>intelligence</em></h1><p className="hero-lede">Assess a forex platform before you invest. Trade Shield reviews its domain, site security, threat reputation and public claims, then presents sourced findings and limitations to support your due diligence.</p><div className="hero-trust"><span className="trust-icon"><Fingerprint size={16} /></span> Evidence to inform your decision, not guarantee an outcome.</div></div></section>

    <section className="scan-section" id="assessment">
      <div className="assessment-header"><div><span className="section-kicker">WEBSITE SCAN</span><h2>Check a website for reported threats before you deposit</h2><p>Review available threat matches, domain details and site security before you deposit.</p></div><span className="assessment-status"><span className="signal-dot" /> READY</span></div>
      <div className="assessment-grid">
        <div className="scan-panel">
          <div className="scan-panel-head"><span><Radar size={18} /> WEBSITE RISK ASSESSMENT</span><span className="scan-ref">TS / 001</span></div>
          <form className="url-form" onSubmit={validateWebsite}>
            <label htmlFor="website-url">Website address</label>
            <div className="url-input-wrap">
              <Globe2 size={17} />
              <input id="website-url" autoComplete="url" inputMode="url" placeholder="https://example.com" value={website} onChange={(event) => { setWebsite(event.target.value); setAssessmentReady(false); setMessage(""); setPaymentError(""); setNeedsAccount(false); }} aria-describedby="url-message" />
              <button type="submit" aria-label="Review website address"><ArrowRight size={19} /></button>
            </div>
            <p className={message.startsWith("Enter") ? "form-message form-error" : "form-message"} id="url-message" aria-live="polite">{message || "Paste a URL to review it. No scan starts at this step."}</p>
          </form>
          {assessmentReady && <form className="checkout-summary" onSubmit={startWebsiteAssessment}>
            <div className="checkout-price"><span>ONE-TIME ASSESSMENT</span><strong>USD 4</strong></div>
            <p>Enter your M-Pesa number. The prompt shows the payable amount; scanning starts after payment is confirmed.</p>
            <label className="scan-phone-label" htmlFor="scan-mpesa-phone">M-Pesa phone number</label>
            <input className="scan-phone-input" id="scan-mpesa-phone" type="tel" autoComplete="tel" inputMode="tel" minLength={9} maxLength={24} placeholder="+254 7XX XXX XXX" value={mpesaPhone} onChange={(event) => setMpesaPhone(event.target.value)} required />
            {paymentError && <p className="checkout-notice form-error" role="alert">{paymentError} {needsAccount && <a href="/account">Sign in</a>}</p>}
            <button className="button button-dark pay-button" type="submit" disabled={isStartingScan || !mpesaPhone.trim()}>{isStartingScan ? "Opening M-Pesa..." : "Pay and scan once confirmed"} {!isStartingScan && <ArrowRight size={16} />}</button>
          </form>}
          <div className="payment-foot"><ShieldCheck size={14} /> No scan runs before payment is verified.</div>
        </div>
        <aside className="results-panel" aria-live="polite"><div className="results-panel-head"><span><Radar size={17} /> REPORT PREVIEW</span><span className="results-state">AWAITING SCAN</span></div><div className="results-empty"><span className="results-icon"><ShieldCheck size={21} /></span><h3>Signals, put in context</h3><p>Scan findings will include their source and confidence so you can review the evidence.</p></div><div className="signal-preview-grid"><div className="signal-preview threat-history"><div className="signal-preview-head"><span><Activity size={15} /> THREAT HISTORY</span><span className="signal-tag">AFTER SCAN</span></div><p>Reputation checks and reported threat matches, with source details.</p><div className="provider-list"><span>VirusTotal</span><span>Google Safe Browsing</span></div></div><div className="signal-preview community-reports"><div className="signal-preview-head"><span><UsersRound size={15} /> COMMUNITY REPORTS</span><span className="signal-tag is-limited">NOT CONNECTED</span></div><p>Community reviews are not available yet. No user ratings or reports are shown.</p></div></div><div className="results-coverage"><span className="coverage-title">OTHER SCAN AREAS</span><div className="coverage-list">{checklist.filter((item) => item !== "Threat reputation").map((item) => <span key={item}>{item}</span>)}</div></div></aside>
      </div>
    </section>

    <section className="process-section" id="how-it-works"><motion.div className="section-heading" {...reveal}><span className="section-kicker">THE METHOD / 01-04</span><h2>Evidence before <em>opinion.</em></h2><p>AI can explain what the evidence may mean. It does not decide what is true.</p></motion.div><div className="process-steps">{[["01", "Collect", "Technical, domain, identity and publicly available website signals."], ["02", "Compare", "Check relevant Kenyan regulatory information and independent threat sources."], ["03", "Assess", "A configurable risk engine scores observed evidence. Confidence is calculated separately."], ["04", "Explain", "AI helps translate sourced findings into questions and next steps."]].map(([number, title, description]) => <motion.article className="process-step" key={number} {...reveal}><span className="step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div><ArrowDownRight className="step-arrow" size={20} /></motion.article>)}</div></section>

    <section className="intelligence-section" id="intelligence"><div className="intelligence-title"><span className="section-kicker">LOCAL CONTEXT / GLOBAL SIGNALS</span><h2>Built for the Kenyan digital investment landscape.</h2><p>Relevant local context, considered alongside technical evidence from the wider web.</p></div><div className="intelligence-cards"><article className="intelligence-card"><div className="card-mark"><span>KE</span><ArrowRight className="arrow-up-right" size={16} /></div><span className="card-index">01 / REGULATORY CONTEXT</span><h3>Kenyan public sources</h3><p>Where a claimed service appears regulated, compare relevant public register information. A missing match is a prompt to verify, not proof of wrongdoing.</p><span className="card-source">CMA / CBK / SASRA, where applicable</span></article><article className="intelligence-card"><div className="card-mark"><Globe2 size={19} /><ArrowRight className="arrow-up-right" size={16} /></div><span className="card-index">02 / THREAT INTELLIGENCE</span><h3>Signals across the web</h3><p>Threat reputation, domain registration, DNS and certificate details can reveal useful context. Coverage depends on provider availability.</p><span className="card-source">Independent providers / timestamped evidence</span></article><article className="intelligence-card"><div className="card-mark"><ShieldAlert size={19} /><ArrowRight className="arrow-up-right" size={16} /></div><span className="card-index">03 / TECHNICAL REVIEW</span><h3>How the site behaves</h3><p>Redirects, security headers, public claims and company details are reviewed together, not reduced to a single suspicious phrase.</p><span className="card-source">Observed facts / cautious interpretation</span></article></div><p className="regulator-note"><ShieldCheck size={15} /> Regulator information is sourced from official public materials. Trade Shield is not affiliated with a government regulator.</p></section>

    <section className="report-section"><div className="report-copy"><span className="section-kicker">A REPORT YOU CAN QUESTION</span><h2>Show your working.</h2><p>Important findings are paired with what was observed, why it matters, where it came from and when it was checked. You can see where the evidence ends and interpretation begins.</p><a className="text-link" href="#faq">Explore our approach <ArrowRight size={15} /></a></div><div className="report-sample"><div className="sample-top"><span><span className="sample-dot" /> EVIDENCE RECORD</span><span>TS / SAMPLE</span></div><div className="sample-finding"><div className="sample-icon"><Fingerprint size={20} /></div><div><span className="sample-label">REGULATORY IDENTITY</span><h3>Claim needs independent verification</h3></div></div><div className="sample-fields"><div><span>WHAT WE FOUND</span><p>A license claim appears on the website. This preview has not queried an official register.</p></div><div><span>WHY IT MATTERS</span><p>Authorization should be checked against the relevant regulator and service category.</p></div><div className="sample-meta"><span>SOURCE <b>Not checked</b></span><span>CONFIDENCE <b>Unassessed</b></span></div></div><div className="sample-bottom">ILLUSTRATIVE PREVIEW <span>NO LIVE EVIDENCE</span></div></div></section>

    <section className="consultancy-section" id="consultancy"><div className="consultancy-copy"><span className="section-kicker">WHEN YOU NEED A CLOSER LOOK</span><h2>Digital risk, with a human lens.</h2><p>For more complex questions, our consultancy can support investment due diligence, trading-platform verification and corporate digital-risk reviews.</p></div><ConsultancyForm /></section>

    <section className="faq-section" id="faq"><div className="faq-heading"><span className="section-kicker">CLEAR ANSWERS / 01-03</span><h2>Good questions<br />are part of the check.</h2><p>Know what a risk assessment can and cannot tell you.</p></div><div className="faq-list">{faqs.map(([question, answer], index) => <div className="faq-item" key={question}><button aria-expanded={faqOpen === index} onClick={() => setFaqOpen(faqOpen === index ? null : index)}><span>{question}</span><ChevronDown size={18} className={faqOpen === index ? "faq-chevron is-open" : "faq-chevron"} /></button>{faqOpen === index && <p>{answer}</p>}</div>)}</div></section>

    <footer className="site-footer"><div className="footer-main"><a className="wordmark" href="#top"><span className="wordmark-icon"><ShieldCheck size={20} /></span><span>TRADE<span className="wordmark-light">SHIELD</span><small>AFRICA</small></span></a><p>Check before you deposit.<br />A little more clarity for a high-stakes decision.</p><a className="footer-check" href="#assessment">Check a website <ArrowRight size={15} /></a></div><div className="footer-bottom"><span>COPYRIGHT 2026 TRADE SHIELD AFRICA</span><span>TECHNOLOGY-ASSISTED DIGITAL RISK INFORMATION</span><a href="#disclaimer">IMPORTANT INFORMATION <ArrowRight size={12} /></a></div><p className="footer-credit">Powered by Aura Stack Intelligence Systems | New York, USA</p><p className="disclaimer" id="disclaimer">Trade Shield provides technology-assisted digital risk assessment and consultancy information. A risk score is not a definitive legal determination that a website or entity is fraudulent or legitimate. Information may be incomplete, outdated or unavailable. Independently verify authorization, identity, ownership and payment instructions before transferring funds.</p></footer>
    <TSConsoleChat />
  </main>;
}
