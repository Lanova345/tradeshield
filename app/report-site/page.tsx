"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { apiRequest } from "@/lib/site-api";

export default function ReportSitePage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    try {
      await apiRequest("/reports", {
        method: "POST",
        body: JSON.stringify({ website_url: String(formData.get("website_url") || "").trim(), message: String(formData.get("message") || "").trim() }),
      });
      setSubmitted(true);
      event.currentTarget.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Your report could not be sent.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="editorial-page">
      <SiteHeader />
      <section className="editorial-hero">
        <div>
          <span className="editorial-kicker">PRIVATE REPORT INTAKE</span>
          <h1>Report a site</h1>
          <p>Tell us about a website connected to a suspected trading or investment scam. Your report is sent privately to the review team.</p>
        </div>
      </section>
      <section className="editorial-content">
        <p className="editorial-note"><ShieldCheck size={15} /> Reports are not published automatically. An administrator reviews available evidence and sources before deciding whether to publish an article. Do not include passwords, one-time codes, account numbers, or other sensitive financial details.</p>
        {submitted ? <p className="editorial-feedback" role="status">Report received. It will remain private while it is reviewed.</p> : null}
        <form className="editorial-form" onSubmit={submitReport}>
          <label htmlFor="report-website">Website URL</label>
          <input id="report-website" name="website_url" type="url" placeholder="https://example.com" maxLength={2048} required />
          <label htmlFor="report-message">What happened?</label>
          <textarea id="report-message" name="message" minLength={20} maxLength={5000} placeholder="Describe what you experienced, including relevant dates or claims. Do not include private credentials." required />
          {error ? <p className="editorial-feedback is-error" role="alert">{error}</p> : null}
          <button className="editorial-submit" type="submit" disabled={submitting}>{submitting ? "Sending report..." : "Submit report"} {!submitting ? <ArrowRight size={15} /> : null}</button>
        </form>
      </section>
      <SiteFooter />
    </main>
  );
}