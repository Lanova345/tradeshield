"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

type ScanStatus = {
  id: string;
  website: string;
  status: string;
  risk_score: number | null;
  risk_level: string | null;
  confidence: string | null;
  summary: string | null;
  created_at: string;
};

type Evidence = {
  id: string;
  category: string;
  signal: string;
  severity: string;
  value: string | null;
  description: string;
  source: string | null;
  source_url: string | null;
  confidence: string;
  observed_at: string;
};

type ScanReport = ScanStatus & { evidence: Evidence[] };
type PageState = "checking" | "scanning" | "completed" | "pending" | "failed" | "error";

const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const API_BASE_URL = configuredApiUrl.endsWith("/api/v1") ? configuredApiUrl : `${configuredApiUrl}/api/v1`;

export default function PaymentReturnPage() {
  const [state, setState] = useState<PageState>("checking");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    const reference = new URLSearchParams(window.location.search).get("reference");
    if (!reference) {
      timeoutId = window.setTimeout(() => {
        if (!cancelled) setState("error");
      }, 0);
      return () => {
        cancelled = true;
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      };
    }
    const paymentReference = reference;

    let paymentAttempts = 0;
    let scanAttempts = 0;

    async function pollScan(scanId: string) {
      try {
        const response = await fetch(`${API_BASE_URL}/scans/${encodeURIComponent(scanId)}/status`, {
          credentials: "include",
          cache: "no-store",
        });
        if (response.status === 401) throw new Error("Sign in again to view this scan.");
        if (!response.ok) throw new Error("Scan status could not be loaded.");
        const result = (await response.json()) as ScanStatus;
        if (cancelled) return;

        if (result.status === "COMPLETED") {
          const detailResponse = await fetch(`${API_BASE_URL}/scans/${encodeURIComponent(scanId)}`, {
            credentials: "include",
            cache: "no-store",
          });
          if (!detailResponse.ok) throw new Error("The completed report could not be loaded.");
          setReport((await detailResponse.json()) as ScanReport);
          setState("completed");
          return;
        }
        if (result.status === "FAILED") {
          setReport({ ...result, evidence: [] });
          setState("failed");
          return;
        }

        scanAttempts += 1;
        if (scanAttempts >= 60) {
          setState("pending");
          return;
        }
        setState("scanning");
        timeoutId = window.setTimeout(() => void pollScan(scanId), 3000);
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setReport((current) => current ?? { id: "", website: "", status: "FAILED", risk_score: null, risk_level: null, confidence: null, summary: error instanceof Error ? error.message : null, created_at: "", evidence: [] });
        }
      }
    }

    async function pollPayment() {
      try {
        const response = await fetch(`${API_BASE_URL}/payments/${encodeURIComponent(paymentReference)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (response.status === 401) throw new Error("Sign in to the account used for this assessment to continue.");
        if (!response.ok) throw new Error("Payment status could not be checked.");
        const payment = (await response.json()) as { status: string; scan_id: string };
        if (cancelled) return;
        if (payment.status === "PAID") {
          setState("scanning");
          await pollScan(payment.scan_id);
          return;
        }

        paymentAttempts += 1;
        if (paymentAttempts >= 60) {
          setState("pending");
          return;
        }
        timeoutId = window.setTimeout(() => void pollPayment(), 3000);
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setReport({ id: "", website: "", status: "FAILED", risk_score: null, risk_level: null, confidence: null, summary: error instanceof Error ? error.message : null, created_at: "", evidence: [] });
        }
      }
    }

    void pollPayment();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [retryCount]);

  function retry() {
    setState("checking");
    setReport(null);
    setRetryCount((count) => count + 1);
  }

  return (
    <main className="account-page scan-return-page">
      <header className="account-topbar">
        <Link className="account-brand" href="/" aria-label="Trade Shield Africa home">
          <span className="account-brand-icon"><ShieldCheck size={19} /></span>
          <span>TRADE<span>SHIELD</span><small>AFRICA</small></span>
        </Link>
        <div className="account-top-actions">
          <Link href="/#assessment" className="account-back"><ArrowLeft size={15} /> Back to assessment</Link>
          <ThemeToggle />
        </div>
      </header>

      <section className={`scan-return-content${state === "completed" ? " is-complete" : ""}`} aria-live="polite">
        {(state === "checking" || state === "scanning") && <div className="account-panel scan-return-status">
          <span className="consultation-return-icon is-checking"><LoaderCircle size={22} /></span>
          <span className="account-panel-kicker">{state === "checking" ? "PAYMENT STATUS" : "ASSESSMENT IN PROGRESS"}</span>
          <h1>{state === "checking" ? "Checking your payment." : "Your website is being assessed."}</h1>
          <p>{state === "checking" ? "Approve the M-Pesa prompt on your phone. We will start the scan as soon as Paystack confirms payment." : "We are collecting public technical and website evidence. Keep this page open for your report."}</p>
        </div>}

        {state === "completed" && report && <>
          <div className="scan-report-heading">
            <div>
              <span className="account-panel-kicker">ASSESSMENT COMPLETE</span>
              <h1>Website risk report</h1>
              <p>{report.website}</p>
            </div>
            <Link className="scan-report-back" href="/#assessment">Check another website <ArrowRight size={15} /></Link>
          </div>
          <div className="scan-report-overview">
            <article><span>RISK SCORE</span><strong>{report.risk_score ?? "N/A"}<small>/100</small></strong><em>{report.risk_level ?? "Unavailable"}</em></article>
            <article><span>CONFIDENCE</span><strong className="scan-confidence">{report.confidence ?? "Unavailable"}</strong><p>Based on available sources and evidence coverage.</p></article>
            <article className="scan-report-summary"><span>SUMMARY</span><p>{report.summary || "No summary was produced for this assessment."}</p></article>
          </div>
          <section className="scan-evidence-list" aria-labelledby="scan-evidence-title">
            <div className="scan-evidence-heading"><div><span className="account-panel-kicker">OBSERVED SIGNALS</span><h2 id="scan-evidence-title">Evidence and limitations</h2></div><span>{report.evidence.length} findings</span></div>
            {report.evidence.length ? report.evidence.map((item) => <article className="scan-evidence-item" key={item.id}>
              <div className="scan-evidence-meta"><span>{item.category}</span><span>{item.severity}</span></div>
              <h3>{item.signal.replaceAll("_", " ")}</h3>
              <p>{item.description}</p>
              {item.value && <p className="scan-evidence-value">Observed: {item.value}</p>}
              <div className="scan-evidence-source"><span>Source: {item.source || "Not available"}</span><span>Confidence: {item.confidence}</span></div>
            </article>) : <p className="scan-evidence-empty">The scan completed without evidence records.</p>}
          </section>
          <p className="scan-report-disclaimer">This report is an information aid, not a guarantee or legal finding. Verify important identity and authorization claims independently.</p>
        </>}

        {state === "pending" && <div className="account-panel scan-return-status">
          <span className="consultation-return-icon is-pending"><CircleAlert size={22} /></span>
          <span className="account-panel-kicker">STILL WAITING</span>
          <h1>Payment or assessment is taking longer.</h1>
          <p>If you approved the M-Pesa prompt, Paystack may need more time. Check again to continue.</p>
          <button className="account-submit" type="button" onClick={retry}>Check again <ArrowRight size={17} /></button>
        </div>}

        {(state === "failed" || state === "error") && <div className="account-panel scan-return-status">
          <span className="consultation-return-icon is-pending"><CircleAlert size={22} /></span>
          <span className="account-panel-kicker">{state === "failed" ? "ASSESSMENT FAILED" : "STATUS UNAVAILABLE"}</span>
          <h1>{state === "failed" ? "We could not complete this scan." : "We could not load your assessment."}</h1>
          <p>{report?.summary || "Your payment status or report could not be retrieved. No risk conclusion is available."}</p>
          <button className="account-submit" type="button" onClick={retry}>Try again <ArrowRight size={17} /></button>
        </div>}
      </section>

      <footer className="account-footer"><span>TRADE SHIELD AFRICA</span><span>WEBSITE RISK INFORMATION</span><span className="footer-credit">Powered by Aura Stack Intelligence Systems | New York, USA</span></footer>
    </main>
  );
}