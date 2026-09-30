import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer editorial-footer">
      <div className="editorial-footer-main">
        <div className="editorial-footer-brand">
          <Link className="wordmark" href="/" aria-label="Trade Shield Africa home">
            <span className="wordmark-icon"><ShieldCheck size={20} /></span>
            <span>TRADE<span className="wordmark-light">SHIELD</span><small>AFRICA</small></span>
          </Link>
          <p>Evidence-led digital risk information for clearer decisions before you deposit.</p>
        </div>
        <nav className="editorial-footer-nav" aria-label="Footer navigation">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/intelligence">Our intelligence</Link>
          <Link href="/consultancy">Consultancy</Link>
          <Link className="editorial-footer-action" href="/#assessment">Check a website <ArrowRight size={14} /></Link>
        </nav>
      </div>
      <div className="footer-bottom"><span>COPYRIGHT 2026 TRADE SHIELD AFRICA</span></div>
      <p className="footer-credit">Powered by Aura Stack Intelligence Systems | New York, USA</p>
      <p className="disclaimer">Reports are reviewed before publication. Published findings cite their sources and are not legal determinations or guarantees.</p>
    </footer>
  );
}