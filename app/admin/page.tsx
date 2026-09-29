"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Eye, X } from "lucide-react";
import { API_BASE_URL, apiRequest } from "@/lib/site-api";

type AdminUser = { role: string };
type SiteReport = { id: string; website_url: string; message: string; status: string; submitted_at: string; review_notes: string | null };
type NewsArticle = { id: string; title: string; slug: string; status: string; source_urls: string[]; created_at: string };

function sourceList(value: FormDataEntryValue | null) {
  return String(value || "").split(/\r?\n/).map((source) => source.trim()).filter(Boolean);
}

export default function AdminPage() {
  const [access, setAccess] = useState<"loading" | "admin" | "signed-out" | "denied" | "error">("loading");
  const [loginBusy, setLoginBusy] = useState(false);
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function signInAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoginBusy(true);
    const formData = new FormData(event.currentTarget);
    try {
      const user = await apiRequest<AdminUser>("/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: String(formData.get("username") || "").trim(), password: String(formData.get("password") || "") }),
      });
      if (user.role !== "ADMIN") throw new Error("This account does not have administrator permissions.");
      const [nextReports, nextArticles] = await Promise.all([
        apiRequest<SiteReport[]>("/admin/reports"),
        apiRequest<NewsArticle[]>("/admin/news"),
      ]);
      setReports(nextReports);
      setArticles(nextArticles);
      setAccess("admin");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sign in failed.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function refreshContent() {
    const [nextReports, nextArticles] = await Promise.all([
      apiRequest<SiteReport[]>("/admin/reports"),
      apiRequest<NewsArticle[]>("/admin/news"),
    ]);
    setReports(nextReports);
    setArticles(nextArticles);
  }

  useEffect(() => {
    const controller = new AbortController();
    async function initialize() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          setAccess("signed-out");
          return;
        }
        if (!response.ok) throw new Error("Could not verify your account.");
        const user = (await response.json()) as AdminUser;
        if (user.role !== "ADMIN") {
          setAccess("denied");
          return;
        }
        const [nextReports, nextArticles] = await Promise.all([
          apiRequest<SiteReport[]>("/admin/reports", { signal: controller.signal }),
          apiRequest<NewsArticle[]>("/admin/news", { signal: controller.signal }),
        ]);
        setReports(nextReports);
        setArticles(nextArticles);
        setAccess("admin");
      } catch (requestError) {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "The admin dashboard is unavailable.");
          setAccess("error");
        }
      }
    }
    void initialize();
    return () => controller.abort();
  }, []);

  async function runAdminAction(action: () => Promise<unknown>, successMessage: string) {
    setError("");
    setMessage("");
    try {
      await action();
      await refreshContent();
      setMessage(successMessage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The request could not be completed.");
    } finally {
      setBusyId("");
    }
  }

  async function updateReport(reportId: string, action: "review" | "dismiss") {
    setBusyId(reportId);
    await runAdminAction(() => apiRequest(`/admin/reports/${reportId}/${action}`, { method: "POST", body: JSON.stringify({}) }), action === "review" ? "Report moved to review." : "Report dismissed.");
  }

  async function publishReport(event: FormEvent<HTMLFormElement>, report: SiteReport) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusyId(report.id);
    await runAdminAction(() => apiRequest(`/admin/reports/${report.id}/publish`, {
      method: "POST",
      body: JSON.stringify({
        title: String(formData.get("title") || "").trim(),
        site_url: report.website_url,
        summary: String(formData.get("summary") || "").trim(),
        content: String(formData.get("content") || "").trim(),
        source_urls: sourceList(formData.get("sources")),
        confirm_sources_reviewed: formData.get("confirm_sources_reviewed") === "on",
      }),
    }), "Evidence-based article published and report resolved.");
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusyId("new-draft");
    await runAdminAction(async () => {
      await apiRequest("/admin/news", {
        method: "POST",
        body: JSON.stringify({
          title: String(formData.get("title") || "").trim(),
          site_url: String(formData.get("site_url") || "").trim() || null,
          summary: String(formData.get("summary") || "").trim(),
          content: String(formData.get("content") || "").trim(),
          source_urls: sourceList(formData.get("sources")),
        }),
      });
      form.reset();
    }, "Draft saved.");
  }

  async function publishDraft(event: FormEvent<HTMLFormElement>, articleId: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusyId(articleId);
    await runAdminAction(() => apiRequest(`/admin/news/${articleId}/publish`, {
      method: "POST",
      body: JSON.stringify({ confirm_sources_reviewed: formData.get("confirm_sources_reviewed") === "on" }),
    }), "Article published.");
  }

  if (access === "loading") return <main className="admin-page"><p role="status">Verifying administrator access...</p></main>;
  if (access === "signed-out") return <main className="admin-page"><section className="admin-access"><span className="editorial-kicker">PRIVATE WORKSPACE</span><h1>Administrator sign in</h1><p>Use your administrator credentials to access reports and publication tools.</p><form className="editorial-form" onSubmit={(event) => void signInAdmin(event)}><label htmlFor="admin-username">Username</label><input id="admin-username" name="username" autoComplete="username" defaultValue="tradeshield" required /><label htmlFor="admin-password">Password</label><input id="admin-password" name="password" type="password" autoComplete="current-password" minLength={12} required />{error ? <p className="editorial-feedback is-error" role="alert">{error}</p> : null}<button className="editorial-submit" type="submit" disabled={loginBusy}>{loginBusy ? "Signing in..." : "Sign in"} {!loginBusy ? <ArrowRight size={15} /> : null}</button></form><p><Link href="/">Return to Trade Shield</Link></p></section></main>;
  if (access === "denied") return <main className="admin-page"><section className="admin-access"><h1>Access restricted</h1><p>This account does not have administrator permissions.</p><Link href="/">Return to Trade Shield</Link></section></main>;
  if (access === "error") return <main className="admin-page"><section className="admin-access"><h1>Dashboard unavailable</h1><p>{error}</p><Link href="/">Return to Trade Shield</Link></section></main>;

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-topline">
          <div><span className="editorial-kicker">PRIVATE WORKSPACE</span><h1>Editorial dashboard</h1></div>
          <Link href="/"><ArrowLeft size={14} /> Public site</Link>
        </header>
        {message ? <p className="editorial-feedback" role="status">{message}</p> : null}
        {error ? <p className="editorial-feedback is-error" role="alert">{error}</p> : null}

        <section className="admin-section" aria-labelledby="reports-title">
          <div className="admin-section-head"><div><h2 id="reports-title">Submitted site reports</h2><p>Private submissions are never published without review and cited sources.</p></div><span className="admin-status">{reports.length} TOTAL</span></div>
          {reports.length === 0 ? <p className="admin-helper">No site reports have been submitted.</p> : null}
          <div className="admin-list">
            {reports.map((report) => (
              <article className="admin-list-item" key={report.id}>
                <div className="admin-item-heading"><h3>{report.website_url}</h3><span className="admin-status">{report.status} / {new Date(report.submitted_at).toLocaleString()}</span></div>
                <a className="admin-item-url" href={report.website_url} target="_blank" rel="noreferrer">Open reported website</a>
                <p className="admin-item-message">{report.message}</p>
                {report.review_notes ? <p className="admin-helper">Review note: {report.review_notes}</p> : null}
                {report.status !== "PUBLISHED" && report.status !== "DISMISSED" ? <>
                  <div className="admin-actions">
                    <button className="admin-action" type="button" disabled={busyId === report.id} onClick={() => void updateReport(report.id, "review")}><Eye size={14} /> Mark reviewing</button>
                    <button className="admin-action is-danger" type="button" disabled={busyId === report.id} onClick={() => void updateReport(report.id, "dismiss")}><X size={14} /> Dismiss</button>
                  </div>
                  <form className="admin-form" onSubmit={(event) => void publishReport(event, report)}>
                    <label>Article title<input name="title" minLength={5} maxLength={200} defaultValue={`Review of ${new URL(report.website_url).hostname}`} required /></label>
                    <label>Short summary<input name="summary" minLength={20} maxLength={1000} required /></label>
                    <label className="wide">Findings and context<textarea className="article-body-input" name="content" minLength={50} maxLength={20000} required /></label>
                    <label className="wide">Evidence source URLs, one per line<textarea name="sources" placeholder="https://official-source.example/notice" required /></label>
                    <label className="admin-confirm wide"><input type="checkbox" name="confirm_sources_reviewed" required /> I reviewed these sources and the article distinguishes documented facts from allegations.</label>
                    <button className="admin-action is-primary wide" type="submit" disabled={busyId === report.id}>Publish researched article <ArrowRight size={14} /></button>
                  </form>
                </> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="admin-section" aria-labelledby="new-article-title">
          <div className="admin-section-head"><div><h2 id="new-article-title">Write a news update</h2><p>New posts start as drafts. Add citations before publishing.</p></div></div>
          <form className="admin-form" onSubmit={(event) => void createDraft(event)}>
            <label>Article title<input name="title" minLength={5} maxLength={200} required /></label>
            <label>Website under review, if applicable<input name="site_url" type="url" /></label>
            <label className="wide">Summary<input name="summary" minLength={20} maxLength={1000} required /></label>
            <label className="wide">Article content<textarea className="article-body-input" name="content" minLength={50} maxLength={20000} required /></label>
            <label className="wide">Evidence source URLs, one per line<textarea name="sources" placeholder="https://official-source.example/notice" /></label>
            <button className="admin-action is-primary wide" type="submit" disabled={busyId === "new-draft"}>Save draft <Check size={14} /></button>
          </form>
        </section>

        <section className="admin-section" aria-labelledby="articles-title">
          <div className="admin-section-head"><div><h2 id="articles-title">Articles</h2><p>Only published items appear on the public News &amp; updates page.</p></div><span className="admin-status">{articles.length} TOTAL</span></div>
          <div className="admin-list">
            {articles.map((article) => (
              <article className="admin-list-item admin-news-item" key={article.id}>
                <div><div className="admin-item-heading"><h3>{article.title}</h3><span className="admin-status">{article.status}</span></div><p className="admin-helper">{article.source_urls.length} source{article.source_urls.length === 1 ? "" : "s"} / {article.slug}</p></div>
                {article.status !== "PUBLISHED" ? <form onSubmit={(event) => void publishDraft(event, article.id)}>
                  <label className="admin-confirm"><input type="checkbox" name="confirm_sources_reviewed" required /> Sources reviewed</label>
                  <button className="admin-action is-primary" type="submit" disabled={busyId === article.id}>Publish <ArrowRight size={14} /></button>
                </form> : <Link className="admin-item-url" href={`/news/${encodeURIComponent(article.slug)}`} target="_blank">View published</Link>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}