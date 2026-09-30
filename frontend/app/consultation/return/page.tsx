"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { API_BASE_URL } from "@/lib/site-api";

type CheckoutState = "checking" | "paid" | "pending" | "error";

export default function ConsultationReturnPage() {
  const [state, setState] = useState<CheckoutState>("checking");
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

    let attempts = 0;

    async function checkPayment() {
      try {
        const response = await fetch(`${API_BASE_URL}/consultations/payment/${encodeURIComponent(paymentReference)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Payment status could not be checked.");
        const result = (await response.json()) as { status: string };

        if (cancelled) return;
        if (result.status === "PAID") {
          setState("paid");
          return;
        }

        attempts += 1;
        if (attempts >= 60) {
          setState("pending");
          return;
        }
        timeoutId = window.setTimeout(checkPayment, 3000);
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void checkPayment();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [retryCount]);

  function retryPayment() {
    setState("checking");
    setRetryCount((count) => count + 1);
  }

  return (
    <main className="account-page consultation-return-page">
      <header className="account-topbar">
        <Link className="account-brand" href="/" aria-label="Trade Shield Africa home">
          <span className="account-brand-icon"><ShieldCheck size={19} /></span>
          <span>TRADE<span>SHIELD</span><small>AFRICA</small></span>
        </Link>
        <div className="account-top-actions">
          <Link href="/consultancy" className="account-back"><ArrowLeft size={15} /> Back to consultancy</Link>
          <ThemeToggle />
        </div>
      </header>

      <section className="consultation-return-panel account-panel" aria-live="polite">
        {state === "checking" && <>
          <span className="consultation-return-icon is-checking"><LoaderCircle size={22} /></span>
          <span className="account-panel-kicker">PAYMENT STATUS</span>
          <h1>Checking your payment.</h1>
          <p>We are confirming the transaction with Paystack. Approve the M-Pesa prompt on your phone and keep this page open.</p>
        </>}
        {state === "paid" && <>
          <span className="consultation-return-icon is-paid"><Check size={22} /></span>
          <span className="account-panel-kicker">PAYMENT CONFIRMED</span>
          <h1>Your question is with us.</h1>
          <p>We have your question and will be in touch soon to follow up.</p>
          <Link className="account-submit" href="/">Return to Trade Shield <ArrowRight size={17} /></Link>
        </>}
        {state === "pending" && <>
          <span className="consultation-return-icon is-pending"><CircleAlert size={22} /></span>
          <span className="account-panel-kicker">PAYMENT NOT CONFIRMED YET</span>
          <h1>Still waiting on M-Pesa.</h1>
          <p>If you approved the prompt, Paystack may need longer to update. Check again before starting another payment.</p>
          <button className="account-submit" type="button" onClick={retryPayment}>Check again <ArrowRight size={17} /></button>
        </>}
        {state === "error" && <>
          <span className="consultation-return-icon is-pending"><CircleAlert size={22} /></span>
          <span className="account-panel-kicker">PAYMENT STATUS UNAVAILABLE</span>
          <h1>We could not confirm that yet.</h1>
          <p>Your payment has not been marked complete. Check again in a moment or contact us if the issue continues.</p>
          <button className="account-submit" type="button" onClick={retryPayment}>Try again <ArrowRight size={17} /></button>
        </>}
      </section>

      <footer className="account-footer"><span>TRADE SHIELD AFRICA</span><span>SECURE PAYMENT STATUS</span><span className="footer-credit">Powered by Aura Stack Intelligence Systems | New York, USA</span></footer>
    </main>
  );
}