"use client";

import { useState } from "react";

const JOBS = ["brief", "landing", "seo", "social", "framework"] as const;

export default function HomePage() {
  const [job, setJob] = useState<(typeof JOBS)[number]>("brief");
  const [offer, setOffer] = useState("");
  const [provider, setProvider] = useState("auto");
  const [quality, setQuality] = useState("good");
  const [framework, setFramework] = useState("pas");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult("");
    const response = await fetch("/api/marketing/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job, offer, provider, quality, framework, channel: "site" }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Generation failed");
      return;
    }
    setResult(JSON.stringify(data, null, 2));
  }

  return (
    <main>
      <h1>MarketPro</h1>
      <p className="lede">
        Strategy and landing pages go through DeepSeek. Everyday copy stays on the cheaper Ollama Cloud models.
        You can override either one.
      </p>
      <form onSubmit={onSubmit}>
        <label htmlFor="offer">Offer</label>
        <textarea id="offer" value={offer} onChange={(event) => setOffer(event.target.value)} required />
        <div className="row">
          <div>
            <label htmlFor="job">Job</label>
            <select id="job" value={job} onChange={(event) => setJob(event.target.value as (typeof JOBS)[number])}>
              {JOBS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="provider">Model route</label>
            <select id="provider" value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="auto">Auto</option>
              <option value="dsh">DeepSeek</option>
              <option value="ollama_cloud">Ollama Cloud</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label htmlFor="quality">Ollama quality</label>
            <select id="quality" value={quality} onChange={(event) => setQuality(event.target.value)}>
              <option value="good">Good (qwen3.5:cloud)</option>
              <option value="low">Cheap (gemma4:31b-cloud)</option>
            </select>
          </div>
          <div>
            <label htmlFor="framework">Framework</label>
            <select id="framework" value={framework} onChange={(event) => setFramework(event.target.value)}>
              {["pas", "aida", "bab", "fab", "ugc", "hook_body_cta"].map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled={busy}>{busy ? "Writing…" : "Write"}</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {result ? (
        <section className="result">
          <strong>Result</strong>
          <pre>{result}</pre>
        </section>
      ) : null}
    </main>
  );
}
