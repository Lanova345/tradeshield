"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { apiRequest } from "@/lib/site-api";

type NewsArticle = {
  title: string;
  slug: string;
  site_url: string | null;
  summary: string;
  content: string;
  source_urls: string[];
  published_at: string;
};

export default function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<NewsArticle>(`/news/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(setArticle)
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "This article could not be loaded.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [slug]);

  return (
    <main className="editorial-page">
      <SiteHeader />
      <section className="editorial-hero">
        <div>
          <Link className="news-read-link" href="/news"><ArrowLeft size={14} /> All news</Link>
          {loading ? <p className="editorial-state" role="status">Loading article...</p> : null}
          {error ? <p className="editorial-state editorial-feedback is-error" role="alert">{error}</p> : null}
          {article ? <>
            <span className="editorial-kicker">RESEARCH / REVIEW</span>
            <h1>{article.title}</h1>
            <p>{article.summary}</p>
          </> : null}
        </div>
      </section>
      {article ? <article className="editorial-content">
        <div className="article-meta">
          <time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString()}</time>
          {article.site_url ? <a className="news-read-link" href={article.site_url} target="_blank" rel="noreferrer">{new URL(article.site_url).hostname} <ExternalLink size={13} /></a> : null}
        </div>
        <div className="article-content">{article.content}</div>
        <section className="article-sources" aria-labelledby="article-sources-title">
          <h2 id="article-sources-title">Sources</h2>
          <ul>{article.source_urls.map((source) => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>)}</ul>
        </section>
      </article> : null}
      <SiteFooter />
    </main>
  );
}