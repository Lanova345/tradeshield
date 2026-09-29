"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { apiRequest } from "@/lib/site-api";

type NewsArticle = {
  title: string;
  slug: string;
  site_url: string | null;
  summary: string;
  published_at: string;
};

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<NewsArticle[]>("/news", { signal: controller.signal })
      .then(setArticles)
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "News could not be loaded.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <main className="editorial-page">
      <SiteHeader />
      <section className="editorial-hero">
        <div>
          <span className="editorial-kicker">RESEARCH / UPDATES</span>
          <h1>News &amp; updates</h1>
          <p>Evidence-led reviews of reported website risks, new scam patterns, and practical ways to verify a trading service before sending money.</p>
        </div>
      </section>
      <section className="editorial-content news-list" aria-label="Published news and updates">
        {loading ? <p className="editorial-state" role="status">Loading published updates...</p> : null}
        {error ? <p className="editorial-state editorial-feedback is-error" role="alert">{error}</p> : null}
        {!loading && !error && articles.length === 0 ? <p className="editorial-state">No updates have been published yet.</p> : null}
        {articles.map((article) => (
          <article className="news-item" key={article.slug}>
            <div>
              <time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString()}</time>
              {article.site_url ? <p className="news-item-site">{new URL(article.site_url).hostname}</p> : null}
            </div>
            <div>
              <h2><Link href={`/news/${encodeURIComponent(article.slug)}`}>{article.title}</Link></h2>
              <p>{article.summary}</p>
              <Link className="news-read-link" href={`/news/${encodeURIComponent(article.slug)}`}>Read the review <ArrowRight size={14} /></Link>
            </div>
          </article>
        ))}
      </section>
      <SiteFooter />
    </main>
  );
}