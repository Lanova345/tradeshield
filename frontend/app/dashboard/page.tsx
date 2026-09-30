"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleUserRound, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { API_BASE_URL } from "@/lib/site-api";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/account");
          return;
        }
        if (!response.ok) throw new Error("We could not load your account. Please try again.");
        setUser((await response.json()) as AuthUser);
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError("The account service is unavailable. Please try again shortly.");
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [router]);

  async function signOut() {
    setIsSigningOut(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("We could not sign you out. Please try again.");
      router.replace("/account");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not sign you out. Please try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <main className="account-page dashboard-page">
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

      <div className="dashboard-content">
        {isLoading ? (
          <div className="account-panel account-loading" role="status">Loading your dashboard...</div>
        ) : error && !user ? (
          <section className="account-panel dashboard-error" role="alert">
            <span className="account-panel-kicker">ACCOUNT ACCESS</span>
            <h1>We could not open your dashboard.</h1>
            <p>{error}</p>
            <button className="account-submit" type="button" onClick={() => window.location.reload()}>Try again <ArrowRight size={17} /></button>
            <Link className="account-home-link" href="/account">Return to account sign in</Link>
          </section>
        ) : user ? (
          <>
            <div className="dashboard-heading">
              <div>
                <span className="account-panel-kicker">TRADE SHIELD / YOUR ACCOUNT</span>
                <h1>Good to have you here, {user.name.split(" ")[0]}.</h1>
                <p>Your account is ready. Start with a website assessment whenever you need one.</p>
              </div>
              <button className="dashboard-signout" type="button" onClick={signOut} disabled={isSigningOut}>
                <LogOut size={16} /> {isSigningOut ? "Signing out..." : "Sign out"}
              </button>
            </div>

            {error && <p className="account-error" role="alert">{error}</p>}

            <div className="dashboard-grid">
              <section className="dashboard-profile" aria-labelledby="dashboard-profile-title">
                <div className="dashboard-section-head">
                  <span className="dashboard-profile-icon"><CircleUserRound size={19} /></span>
                  <div><span className="account-panel-kicker">PROFILE</span><h2 id="dashboard-profile-title">Account details</h2></div>
                </div>
                <dl className="dashboard-fields">
                  <div><dt>Full name</dt><dd>{user.name}</dd></div>
                  <div><dt>Email address</dt><dd>{user.email}</dd></div>
                  <div><dt>Account type</dt><dd>{user.role === "USER" ? "Customer" : user.role}</dd></div>
                </dl>
                <div className="dashboard-security"><ShieldCheck size={16} /><span>Password is securely stored as a hash and never shown here.</span></div>
              </section>

              <section className="dashboard-next-step" aria-labelledby="dashboard-next-title">
                <span className="dashboard-check-icon"><Check size={18} /></span>
                <span className="account-panel-kicker">READY WHEN YOU ARE</span>
                <h2 id="dashboard-next-title">Check a website before you deposit.</h2>
                <p>Review what an assessment checks and its cost before requesting a scan.</p>
                <Link className="account-submit" href="/#assessment">Start an assessment <ArrowRight size={17} /></Link>
              </section>
            </div>

            <p className="dashboard-note">A risk score is an information aid, not a guarantee or legal finding. Verify important details with the relevant official sources.</p>
          </>
        ) : null}
      </div>

      <footer className="account-footer"><span>TRADE SHIELD AFRICA</span><span>SECURE ACCOUNT ACCESS</span><span className="footer-credit">Powered by Aura Stack Intelligence Systems | New York, USA</span></footer>
    </main>
  );
}