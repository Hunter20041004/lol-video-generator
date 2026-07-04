"use client";

import React, { useEffect, useMemo, useState } from "react";

const COPY = {
  zh: {
    eyebrow: "PERFORMANCE COMMAND",
    title: "內容成效總覽",
    subtitle: "快速比較平台、語言與逐篇內容，找出下一批值得複製的題材。",
    sync: "同步最新成效",
    syncing: "同步中...",
    refresh: "重新整理",
    totalViews: "總觀看",
    engagements: "總互動",
    engagementRate: "整體互動率",
    trackedPosts: "追蹤貼文",
    synced: "已同步",
    platformPulse: "平台表現",
    languageSplit: "語言分布",
    posts: "逐篇成效",
    search: "搜尋貼文標題",
    allPlatforms: "全部平台",
    allLocales: "全部語言",
    zh: "中文",
    en: "英文",
    sortViews: "觀看最高",
    sortEngagements: "互動最高",
    sortRate: "互動率最高",
    sortRecent: "最新發布",
    post: "貼文",
    views: "觀看",
    interactions: "互動",
    rate: "互動率",
    details: "細項",
    status: "狀態",
    open: "查看貼文",
    noLink: "無公開連結",
    noPosts: "沒有符合條件的貼文。",
    lastSync: "最後同步",
    syncDone: "同步完成",
    failed: "載入成效失敗",
  },
  en: {
    eyebrow: "PERFORMANCE COMMAND",
    title: "Content Performance",
    subtitle: "Compare platforms, languages, and individual posts to find the ideas worth repeating.",
    sync: "Sync latest insights",
    syncing: "Syncing...",
    refresh: "Refresh",
    totalViews: "Total views",
    engagements: "Engagements",
    engagementRate: "Engagement rate",
    trackedPosts: "Tracked posts",
    synced: "synced",
    platformPulse: "Platform pulse",
    languageSplit: "Language split",
    posts: "Post performance",
    search: "Search post titles",
    allPlatforms: "All platforms",
    allLocales: "All languages",
    zh: "Chinese",
    en: "English",
    sortViews: "Most views",
    sortEngagements: "Most engagements",
    sortRate: "Highest rate",
    sortRecent: "Newest",
    post: "Post",
    views: "Views",
    interactions: "Engagements",
    rate: "Rate",
    details: "Details",
    status: "Status",
    open: "Open post",
    noLink: "No public link",
    noPosts: "No posts match these filters.",
    lastSync: "Last synced",
    syncDone: "Sync complete",
    failed: "Could not load insights",
  },
};

const formatNumber = (value) => new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
}).format(Number(value) || 0);

const formatRate = (value) => `${((Number(value) || 0) * 100).toFixed(2)}%`;

const formatDate = (value, locale) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-TW" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const platformLabel = (platform) => platform === "instagram" ? "Instagram" : "Threads";

const statusLabel = (status) => ({
  SYNCED: "SYNCED",
  NEEDS_AUTH: "NEEDS AUTH",
  ERROR: "ERROR",
  PENDING: "PENDING",
}[status] || status);

function MetricBlock({ label, value, note, accent = "gold" }) {
  return (
    <div className={`insights-metric insights-metric--${accent}`}>
      <div className="insights-metric__label">{label}</div>
      <div className="insights-metric__value">{value}</div>
      <div className="insights-metric__note">{note}</div>
    </div>
  );
}

function DistributionPanel({ title, rows, maxViews }) {
  return (
    <section className="insights-panel">
      <div className="insights-panel__title">{title}</div>
      <div className="insights-distribution">
        {rows.map((row) => (
          <div className="insights-distribution__row" key={row.key}>
            <div className="insights-distribution__heading">
              <span className={`insights-platform insights-platform--${row.key}`}>{row.label}</span>
              <strong>{formatNumber(row.views)}</strong>
            </div>
            <div className="insights-bar">
              <span style={{ width: `${maxViews > 0 ? Math.max(3, (row.views / maxViews) * 100) : 0}%` }} />
            </div>
            <div className="insights-distribution__meta">
              <span>{row.posts} posts</span>
              <span>{formatNumber(row.engagements)} engagements</span>
              <span>{formatRate(row.engagementRate)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailMetrics({ post }) {
  const metrics = post.latest?.metrics || {};
  const details = post.platform === "instagram"
    ? [["Reach", metrics.reach], ["Likes", metrics.likes], ["Saved", metrics.saved], ["Shares", metrics.shares]]
    : [["Likes", metrics.likes], ["Replies", metrics.replies], ["Reposts", metrics.reposts], ["Quotes", metrics.quotes]];

  return (
    <div className="insights-detail-metrics">
      {details.map(([label, value]) => (
        <span key={label}><b>{formatNumber(value)}</b> {label}</span>
      ))}
    </div>
  );
}

export function InsightsDashboard({ locale = "zh" }) {
  const lang = locale === "en" ? "en" : "zh";
  const text = COPY[lang];
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [platform, setPlatform] = useState("");
  const [postLocale, setPostLocale] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("views");

  const loadReport = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/insights", { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || text.failed);
      setReport(json.report);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const syncInsights = async () => {
    setSyncing(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || text.failed);
      setNotice(`${text.syncDone}: ${json.synced || 0}/${json.considered || 0}`);
      await loadReport({ quiet: true });
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      setSyncing(false);
    }
  };

  const posts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(report?.posts || [])]
      .filter((post) => !platform || post.platform === platform)
      .filter((post) => !postLocale || post.locale === postLocale)
      .filter((post) => !normalizedQuery || post.title.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (sort === "engagements") return (b.latest?.engagements || 0) - (a.latest?.engagements || 0);
        if (sort === "rate") return (b.latest?.engagementRate || 0) - (a.latest?.engagementRate || 0);
        if (sort === "recent") return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
        return (b.latest?.views || 0) - (a.latest?.views || 0);
      });
  }, [platform, postLocale, query, report, sort]);

  if (loading) {
    return (
      <div className="insights-loading">
        <div className="spinner" />
        <span>{lang === "zh" ? "載入成效資料..." : "Loading performance..."}</span>
      </div>
    );
  }

  const totals = report?.totals || {};
  const platformRows = ["instagram", "threads"].map((key) => ({
    key,
    label: platformLabel(key),
    ...(report?.byPlatform?.[key] || {}),
  }));
  const localeRows = ["zh", "en"].map((key) => ({
    key,
    label: text[key],
    ...(report?.byLocale?.[key] || {}),
  }));
  const maxPlatformViews = Math.max(...platformRows.map((row) => row.views || 0), 0);
  const maxLocaleViews = Math.max(...localeRows.map((row) => row.views || 0), 0);

  return (
    <div className="insights-dashboard">
      <div className="insights-hero">
        <div>
          <div className="insights-eyebrow">{text.eyebrow}</div>
          <h2>{text.title}</h2>
          <p>{text.subtitle}</p>
        </div>
        <div className="insights-actions">
          <div className="insights-sync-meta">
            <span>{text.lastSync}</span>
            <strong>{formatDate(totals.lastSyncedAt, lang)}</strong>
          </div>
          <button className="insights-button insights-button--quiet" onClick={() => loadReport()} disabled={syncing}>
            {text.refresh}
          </button>
          <button className="insights-button" onClick={syncInsights} disabled={syncing}>
            {syncing ? text.syncing : text.sync}
          </button>
        </div>
      </div>

      {(notice || error) && (
        <div className={`insights-notice ${error ? "insights-notice--error" : ""}`}>
          {error ? `${text.failed}: ${error}` : notice}
        </div>
      )}

      <div className="insights-scoreboard">
        <MetricBlock label={text.totalViews} value={formatNumber(totals.views)} note={`${totals.posts || 0} posts`} accent="magic" />
        <MetricBlock label={text.engagements} value={formatNumber(totals.engagements)} note="likes · comments · shares" accent="gold" />
        <MetricBlock label={text.engagementRate} value={formatRate(totals.engagementRate)} note={`${formatNumber(totals.engagements)} / ${formatNumber(totals.views)}`} accent="violet" />
        <MetricBlock label={text.trackedPosts} value={formatNumber(totals.posts)} note={`${totals.synced || 0} ${text.synced}`} accent="green" />
      </div>

      <div className="insights-splits">
        <DistributionPanel title={text.platformPulse} rows={platformRows} maxViews={maxPlatformViews} />
        <DistributionPanel title={text.languageSplit} rows={localeRows} maxViews={maxLocaleViews} />
      </div>

      <section className="insights-table-panel">
        <div className="insights-table-header">
          <div>
            <div className="insights-panel__title">{text.posts}</div>
            <div className="insights-table-count">{posts.length} / {totals.posts || 0}</div>
          </div>
          <div className="insights-filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} />
            <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
              <option value="">{text.allPlatforms}</option>
              <option value="instagram">Instagram</option>
              <option value="threads">Threads</option>
            </select>
            <select value={postLocale} onChange={(event) => setPostLocale(event.target.value)}>
              <option value="">{text.allLocales}</option>
              <option value="zh">{text.zh}</option>
              <option value="en">{text.en}</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="views">{text.sortViews}</option>
              <option value="engagements">{text.sortEngagements}</option>
              <option value="rate">{text.sortRate}</option>
              <option value="recent">{text.sortRecent}</option>
            </select>
          </div>
        </div>

        <div className="insights-table">
          <div className="insights-table__head">
            <span>{text.post}</span>
            <span>{text.views}</span>
            <span>{text.interactions}</span>
            <span>{text.rate}</span>
            <span>{text.details}</span>
            <span>{text.status}</span>
          </div>
          {posts.length === 0 && <div className="insights-empty">{text.noPosts}</div>}
          {posts.map((post, index) => (
            <article className="insights-table__row" key={post.id}>
              <div className="insights-post">
                <span className="insights-rank">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <div className="insights-post__badges">
                    <span className={`insights-platform insights-platform--${post.platform}`}>{platformLabel(post.platform)}</span>
                    <span className="insights-locale">{post.locale.toUpperCase()}</span>
                  </div>
                  <strong title={post.title}>{post.title}</strong>
                  <small>{formatDate(post.publishedAt, lang)}</small>
                </div>
              </div>
              <div className="insights-number">{formatNumber(post.latest?.views)}</div>
              <div className="insights-number">{formatNumber(post.latest?.engagements)}</div>
              <div className="insights-rate">{formatRate(post.latest?.engagementRate)}</div>
              <DetailMetrics post={post} />
              <div className="insights-row-action">
                <span className={`insights-status insights-status--${post.status.toLowerCase()}`}>{statusLabel(post.status)}</span>
                {post.url ? (
                  <a href={post.url} target="_blank" rel="noreferrer">{text.open}</a>
                ) : (
                  <span className="insights-no-link">{text.noLink}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
