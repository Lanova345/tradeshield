"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { API_BASE_URL } from "@/lib/site-api";

type AuthMode = "register" | "login";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type ApiProblem = {
  detail?: string | Array<{ msg?: string }>;
};

async function getErrorMessage(response: Response) {
  try {
    const problem = (await response.json()) as ApiProblem;
    if (typeof problem.detail === "string") return problem.detail;
    if (Array.isArray(problem.detail)) return problem.detail.map((issue) => issue.msg).filter(Boolean).join(" ");
  } catch {
    return "The account service returned an unexpected response.";
  }

  return "We could not complete that request. Please try again.";
}

export default function AccountPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("register");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) setUser((await response.json()) as AuthUser);
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError("The account service is unavailable. Please try again shortly.");
        }
      })
      .finally(() => setIsCheckingSession(false));

    return () => controller.abort();
  }, []);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (mode === "register" && password !== confirmPassword) {
      setError("Your passwords do not match.");
      setIsSubmitting(false);
      return;
    }

    const payload = mode === "register"
      ? { name, email, phone: phone || null, password }
      : { email, password };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response));

      const account = (await response.json()) as AuthUser;
      setUser(account);
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not complete that request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      setUser(null);
      setMode("login");
      setNotice("You have signed out.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not sign you out. Please try again.");
    }
  }

  return (
    <main className="account-page">
      <header className="account-topbar">
        <Link className="account-brand" href="/" aria-label="Trade Shield Africa home">
          <span className="account-brand-icon"><ShieldCheck size={19} /></span>
          <span>TRADE<span>SHIELD</span><small>AFRICA</small></span>
        </Link>
        <div className="account-top-actions">
          <Link href="/" className="account-back"><ArrowLeft size={15} /> Back to home</Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="account-layout">
        <section className="account-story" aria-labelledby="account-story-title">
          <span className="account-kicker"><span /> PRIVATE ACCOUNT ACCESS</span>
          <h1 id="account-story-title">Clarity for every next step.</h1>
          <p>Create an account to keep your Trade Shield activity connected to you, with a secure session and a clear record of your requests.</p>
          <div className="account-benefits">
            <div><span><Check size={15} /></span><p>Account details stay private</p></div>
            <div><span><Check size={15} /></span><p>Protected by a secure sign-in session</p></div>
            <div><span><Check size={15} /></span><p>Evidence-led information, not guarantees</p></div>
          </div>
          <div className="account-story-foot"><LockKeyhole size={15} /> Your password is never returned by the service.</div>
        </section>

        <section className="account-panel" aria-labelledby="account-panel-title">
          {isCheckingSession ? (
            <div className="account-loading" role="status">Checking your session...</div>
          ) : user ? (
            <div className="account-signed-in">
              <span className="account-success-icon"><Check size={21} /></span>
              <span className="account-panel-kicker">ACCOUNT ACTIVE</span>
              <h2 id="account-panel-title">Welcome, {user.name.split(" ")[0]}.</h2>
              <p className="account-intro">You are signed in as <strong>{user.email}</strong>.</p>
              {notice && <p className="account-notice" role="status">{notice}</p>}
              {error && <p className="account-error" role="alert">{error}</p>}
              <button className="account-submit account-signout" type="button" onClick={signOut}>Sign out <ArrowRight size={17} /></button>
              <Link className="account-home-link" href="/">Return to Trade Shield</Link>
            </div>
          ) : (
            <>
              <span className="account-panel-kicker">TRADE SHIELD / ACCOUNT</span>
              <h2 id="account-panel-title">{mode === "register" ? "Create your account" : "Welcome back"}</h2>
              <p className="account-intro">{mode === "register" ? "A few details to get started." : "Sign in to continue to your account."}</p>

              <div className="account-mode-switch" role="group" aria-label="Account access mode">
                <button type="button" aria-pressed={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => { setMode("register"); setError(""); setNotice(""); }}>Create account</button>
                <button type="button" aria-pressed={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Sign in</button>
              </div>

              <form className="account-form" onSubmit={submitCredentials}>
                {mode === "register" && <>
                  <label htmlFor="account-name">Full name</label>
                  <input id="account-name" name="name" type="text" autoComplete="name" placeholder="Your name" minLength={2} maxLength={160} required />
                  <label htmlFor="account-phone">Phone number <span>Optional</span></label>
                  <input id="account-phone" name="phone" type="tel" autoComplete="tel" placeholder="+254 7XX XXX XXX" maxLength={40} />
                </>}
                <label htmlFor="account-email">Email address</label>
                <input id="account-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
                <label htmlFor="account-password">Password <span>12 characters minimum</span></label>
                <div className="account-password-field">
                  <input id="account-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={12} maxLength={128} placeholder="At least 12 characters" required />
                  <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
                {mode === "register" && <>
                  <label htmlFor="account-confirm-password">Confirm password</label>
                  <input id="account-confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} placeholder="Enter your password again" required />
                </>}
                {error && <p className="account-error" role="alert">{error}</p>}
                {notice && <p className="account-notice" role="status">{notice}</p>}
                <button className="account-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}
                  {!isSubmitting && <ArrowRight size={17} />}
                </button>
              </form>
              <p className="account-terms">By continuing, you agree to use Trade Shield as an information service. We never ask for investment account passwords.</p>
            </>
          )}
        </section>
      </div>

      <footer className="account-footer"><span>TRADE SHIELD AFRICA</span><span>SECURE ACCOUNT ACCESS</span><span className="footer-credit">Powered by Aura Stack Intelligence Systems | New York, USA</span></footer>
    </main>
  );
}