"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const API_BASE_URL = configuredApiUrl.endsWith("/api/v1") ? configuredApiUrl : `${configuredApiUrl}/api/v1`;

export function ConsultancyForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function startConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      question: String(formData.get("question") || "").trim(),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/consultations/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const problem = await response.json().catch(() => null) as { detail?: string } | null;
        throw new Error(problem?.detail || "We could not start Paystack checkout. Please try again.");
      }

      const checkout = (await response.json()) as { reference?: string; status?: string; display_text?: string };
      if (!checkout.reference || checkout.status !== "pay_offline") throw new Error("Paystack did not send an M-Pesa prompt.");
      const prompt = checkout.display_text ? `&prompt=${encodeURIComponent(checkout.display_text)}` : "";
      router.push(`/consultation/return?reference=${encodeURIComponent(checkout.reference)}${prompt}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not start Paystack checkout. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="consultancy-form" onSubmit={startConsultation}>
      <label htmlFor="consultation-email">Email address</label>
      <input id="consultation-email" name="email" type="email" autoComplete="email" maxLength={320} placeholder="you@example.com" required />
      <label htmlFor="consultation-phone">M-Pesa phone number</label>
      <input id="consultation-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" minLength={9} maxLength={24} placeholder="+254 7XX XXX XXX" required />
      <label htmlFor="consultation-question">Your question</label>
      <textarea id="consultation-question" name="question" minLength={15} maxLength={5000} rows={4} placeholder="What would you like our team to review?" required />
      <p className="consultancy-form-note">Please leave out passwords, account numbers, or other sensitive information.</p>
      {error && <p className="consultancy-form-error" role="alert">{error}</p>}
      <div className="consultancy-form-footer">
        <div><span>CONSULTATION</span><strong>KES 2,000</strong></div>
        <button className="consultancy-pay-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Opening Paystack..." : "Continue to M-Pesa"}
          {!isSubmitting && <ArrowRight size={16} />}
        </button>
      </div>
      <p className="consultancy-payment-note">Paystack will send an M-Pesa prompt to your phone. Your question is stored with the pending request and marked paid only after confirmation.</p>
    </form>
  );
}