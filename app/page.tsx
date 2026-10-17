"use client";

import { useEffect, useState } from "react";
import type { Campaign } from "@/lib/marketing/campaign";

type Providers = {
  providers: { id: string; label: string; configured: boolean; defaultModel?: string; qualityModel?: string }[];
};

const STORAGE_KEY = "marketpro.desk";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function routeLabel(route: { provider: string; model: string; fallback_from?: string } | undefined): string {
  if (!route) return "";
  const via = route.provider === "dsh" ? "DeepSeek" : "Ollama Cloud";
  return route.fallback_from ? `${via} · ${route.model} · fell back from DeepSeek` : `${via} · ${route.model}`;
}

export default function HomePage() {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [voice, setVoice] = useState("");
  const [url, setUrl] = useState("");
  const [proof, setProof] = useState("");
  const [banned, setBanned] = useState("guaranteed, 10x overnight");
  const [offer, setOffer] = useState("");
  const [provider, setProvider] = useState("auto");
  const [quality, setQuality] = useState("good");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [providers, setProviders] = useState<Providers["providers"]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { offer?: string; campaign?: Campaign; name?: string; audience?: string; voice?: string; url?: string; proof?: string; banned?: string };
        setOffer(parsed.offer || "");
        setCampaign(parsed.campaign || null);
        setName(parsed.name || "");
        setAudience(parsed.audience || "");
        setVoice(parsed.voice || "");
        setUrl(parsed.url || "");
        setProof(parsed.proof || "");
        setBanned(parsed.banned || "");
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    fetch("/api/marketing/providers")
      .then((response) => response.json())
      .then((data: Providers) => setProviders(data.providers || []))
      .catch(() => setProviders([]));
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/marketing/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offer,
        provider,
        quality,
        start: today(),
        brand: {
          name,
          audience,
          voice,
          url,
          proof,
          banned: banned.split(",").map((item) => item.trim()).filter(Boolean),
        },
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Campaign failed");
      return;
    }
    setCampaign(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ offer, campaign: data, name, audience, voice, url, proof, banned }));
  }

  const lead = campaign?.lead;

  return (
    <main>
      <header className="top">
        <div>
          <h1>MarketPro</h1>
          <p className="lede">One run writes the brief, the page, the search snippet, the posts, and a two-week calendar.</p>
        </div>
        <div className="pills">
          {providers.map((item) => (
            <span key={item.id} className={item.configured ? "pill on" : "pill"}>
              {item.label}
              {item.configured ? "" : " · key missing"}
            </span>
          ))}
        </div>
      </header>

      <form onSubmit={onSubmit}>
        <label htmlFor="offer">Offer</label>
        <textarea id="offer" value={offer} onChange={(event) => setOffer(event.target.value)} required placeholder="What are you selling, and to whom?" />
        <div className="row">
          <div>
            <label htmlFor="name">Brand</label>
            <input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label htmlFor="audience">Audience</label>
            <input id="audience" value={audience} onChange={(event) => setAudience(event.target.value)} />
          </div>
        </div>
        <div className="row">
          <div>
            <label htmlFor="voice">Voice</label>
            <input id="voice" value={voice} onChange={(event) => setVoice(event.target.value)} />
          </div>
          <div>
            <label htmlFor="url">Site URL</label>
            <input id="url" value={url} onChange={(event) => setUrl(event.target.value)} />
          </div>
        </div>
        <label htmlFor="proof">Proof you can actually use</label>
        <textarea id="proof" value={proof} onChange={(event) => setProof(event.target.value)} placeholder="Leave blank if you do not have a number, quote, or result yet." />
        <label htmlFor="banned">Banned phrases, comma separated</label>
        <input id="banned" value={banned} onChange={(event) => setBanned(event.target.value)} />
        <div className="row">
          <div>
            <label htmlFor="provider">Model route</label>
            <select id="provider" value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="auto">Auto · DeepSeek for strategy, Ollama Cloud for the rest</option>
              <option value="dsh">DeepSeek only</option>
              <option value="ollama_cloud">Ollama Cloud only</option>
            </select>
          </div>
          <div>
            <label htmlFor="quality">Ollama quality</label>
            <select id="quality" value={quality} onChange={(event) => setQuality(event.target.value)}>
              <option value="good">Good · qwen3.5:cloud</option>
              <option value="low">Cheap · gemma4:31b-cloud</option>
            </select>
          </div>
        </div>
        <button type="submit" disabled={busy}>{busy ? "Running the desk…" : "Run campaign"}</button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {campaign ? (
        <div className="desk">
          <section>
            <h2>Brief</h2>
            {campaign.brief.ok ? (
              <>
                <p className="meta">{routeLabel(campaign.brief.value.route)}</p>
                <h3>{String(campaign.brief.value.output.title || "Untitled")}</h3>
                <p>{String(campaign.brief.value.output.idea || "")}</p>
                <p className="meta">Tension: {String(campaign.brief.value.output.tension || "—")} · Promise: {String(campaign.brief.value.output.promise || "—")}</p>
              </>
            ) : <p className="error">{campaign.brief.error}</p>}
          </section>

          <section>
            <h2>Landing page {campaign.landing.ok && campaign.landing.score ? <span className="score">{campaign.landing.score.score}</span> : null}</h2>
            {campaign.landing.ok ? (
              <>
                <p className="meta">{routeLabel(campaign.landing.value.route)}</p>
                <h3>{String(campaign.landing.value.output.headline || "")}</h3>
                <p>{String(campaign.landing.value.output.subhead || "")}</p>
                <p>{String(campaign.landing.value.output.problem || "")}</p>
                <p><strong>{String(campaign.landing.value.output.cta || "")}</strong></p>
                {campaign.landing.score?.flags.length ? <p className="error">{campaign.landing.score.flags.join(" · ")}</p> : null}
              </>
            ) : <p className="error">{campaign.landing.error}</p>}
          </section>

          <section>
            <h2>Search</h2>
            {campaign.seo.ok ? (
              <>
                <p className="meta">{routeLabel(campaign.seo.value.route)}</p>
                <h3>{String(campaign.seo.value.output.title || "")}</h3>
                <p>{String(campaign.seo.value.output.description || "")}</p>
              </>
            ) : <p className="error">{campaign.seo.error}</p>}
          </section>

          <section>
            <h2>Posts</h2>
            {campaign.social.ok ? (
              campaign.social.posts.length ? campaign.social.posts.map((post) => (
                <article key={`${post.channel}-${post.hook}`} className="card">
                  <p className="meta">{post.channel} · score {post.score}</p>
                  <h3>{post.hook}</h3>
                  <p>{post.body}</p>
                </article>
              )) : <p className="meta">No posts came back.</p>
            ) : <p className="error">{campaign.social.error}</p>}
          </section>

          <section>
            <h2>Variants {lead ? <span className="meta">Lead is {lead.framework} · {lead.score}</span> : null}</h2>
            {campaign.variants.map((variant) => (
              "error" in variant ? (
                <p key={variant.framework} className="error">{variant.framework}: {variant.error}</p>
              ) : (
                <article key={variant.framework} className={lead?.framework === variant.framework ? "card lead" : "card"}>
                  <p className="meta">{variant.framework} · score {variant.score}</p>
                  <h3>{variant.hook}</h3>
                  <p>{variant.body}</p>
                  <p><strong>{variant.cta}</strong></p>
                </article>
              )
            ))}
          </section>

          <section>
            <h2>Next 14 days</h2>
            {campaign.calendar.length ? (
              <ol className="calendar">
                {campaign.calendar.map((item) => (
                  <li key={`${item.date}-${item.title}`}>
                    <span>{item.date}</span>
                    <span>{item.channel}</span>
                    <strong>{item.title}</strong>
                  </li>
                ))}
              </ol>
            ) : <p className="meta">Nothing to schedule until a page or a post lands.</p>}
          </section>

          <section>
            <h2>Placement packs</h2>
            <p className="meta">Export only. Nothing is published.</p>
            {campaign.placements.map((pack) => (
              <p key={pack.platform} className="meta">{pack.platform}: {pack.placements.map((row) => row.placement).join(", ")}</p>
            ))}
          </section>
        </div>
      ) : null}
    </main>
  );
}
