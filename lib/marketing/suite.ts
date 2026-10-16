export const JOBS = ["brief", "landing", "seo", "social", "framework"] as const;
export const DEEP_JOBS = new Set<Job>(["brief", "landing"]);
export const FRAMEWORKS = ["aida", "pas", "bab", "fab", "ugc", "hook_body_cta"] as const;
export const PROVIDERS = ["auto", "dsh", "ollama_cloud"] as const;

export type Job = (typeof JOBS)[number];
export type Provider = (typeof PROVIDERS)[number];
export type Quality = "low" | "good";

export type ChatMessage = { role: "system" | "user"; content: string };
export type Completer = (model: string, messages: ChatMessage[]) => Promise<string>;

const PLACEMENTS: Record<string, { placement: string; ratio: string; px?: string; limits?: string }[]> = {
  meta: [
    { placement: "feed", ratio: "1:1", px: "1080x1080" },
    { placement: "story", ratio: "9:16", px: "1080x1920" },
    { placement: "reel", ratio: "9:16", px: "1080x1920" },
  ],
  google: [
    { placement: "rsa_headlines", ratio: "text", limits: "30 chars x 15" },
    { placement: "rsa_descriptions", ratio: "text", limits: "90 chars x 4" },
  ],
  tiktok: [{ placement: "in_feed", ratio: "9:16", px: "1080x1920" }],
  linkedin: [{ placement: "feed", ratio: "1.91:1", px: "1200x627" }],
};

export const HONESTY =
  "Never invent testimonials, customer counts, revenue, CTR, ROAS, spend, rankings, or guarantees. If proof was not supplied, say the proof is missing. Return only a JSON object.";

export type Env = {
  deepseekKey: string;
  deepseekBaseUrl: string;
  dshModel: string;
  ollamaKey: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaQualityModel: string;
};

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return {
    deepseekKey: (source.DEEPSEEK_API_KEY || "").trim(),
    deepseekBaseUrl: (source.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
    dshModel: (source.MARKETING_DSH_MODEL || "deepseek-v4-flash").trim() || "deepseek-v4-flash",
    ollamaKey: (source.OLLAMA_API_KEY || "").trim(),
    ollamaBaseUrl: (source.OLLAMA_BASE_URL || "https://ollama.com").replace(/\/$/, ""),
    ollamaModel: (source.MARKETING_OLLAMA_MODEL || "gemma4:31b-cloud").trim() || "gemma4:31b-cloud",
    ollamaQualityModel: (source.MARKETING_OLLAMA_QUALITY_MODEL || "qwen3.5:cloud").trim() || "qwen3.5:cloud",
  };
}

export function catalog(env: Env = readEnv()) {
  return {
    providers: [
      {
        id: "dsh",
        label: "DeepSeek Harness",
        defaultModel: env.dshModel,
        configured: Boolean(env.deepseekKey),
        useFor: ["brief", "landing"],
        note: "Official DeepSeek route (deepseek-official). Set DEEPSEEK_API_KEY.",
      },
      {
        id: "ollama_cloud",
        label: "Ollama Cloud",
        defaultModel: env.ollamaModel,
        qualityModel: env.ollamaQualityModel,
        configured: Boolean(env.ollamaKey),
        useFor: ["seo", "social", "framework"],
        models: [
          { name: env.ollamaModel, cost: "low", useFor: "drafts and variants" },
          { name: env.ollamaQualityModel, cost: "low", useFor: "planning-quality copy" },
        ],
        note: "Calls https://ollama.com. deepseek-v4-pro:cloud stays opt-in because it costs more.",
      },
    ],
    jobs: [...JOBS],
    frameworks: [...FRAMEWORKS].sort(),
    auto: {
      deep: { jobs: [...DEEP_JOBS], provider: "dsh", model: env.dshModel },
      everyday: { jobs: ["seo", "social", "framework"], provider: "ollama_cloud" },
    },
  };
}

export function resolveRoute(
  job: string,
  provider: string = "auto",
  model?: string | null,
  quality: Quality = "good",
  env: Env = readEnv(),
): { provider: "dsh" | "ollama_cloud"; model: string; job: Job } {
  const named = job.trim().toLowerCase();
  if (!JOBS.includes(named as Job)) throw new Error(`job must be one of ${JOBS.join(", ")}`);
  const picked = provider.trim().toLowerCase();
  if (!PROVIDERS.includes(picked as Provider)) throw new Error(`provider must be one of ${PROVIDERS.join(", ")}`);
  const chosen = (model || "").trim();
  const resolved = picked === "auto" ? (DEEP_JOBS.has(named as Job) ? "dsh" : "ollama_cloud") : picked;
  if (chosen) return { provider: resolved as "dsh" | "ollama_cloud", model: chosen, job: named as Job };
  if (resolved === "dsh") return { provider: "dsh", model: env.dshModel, job: named as Job };
  return {
    provider: "ollama_cloud",
    model: quality === "good" ? env.ollamaQualityModel : env.ollamaModel,
    job: named as Job,
  };
}

export function extractJson(text: string): Record<string, unknown> {
  const cleaned = (text || "").replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error(`model did not return JSON: ${cleaned.slice(0, 180)}`);
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function prompt(input: {
  job: Job;
  offer: string;
  audience: string;
  brand: string;
  voice: string;
  framework: string;
  channel: string;
  url: string;
}): string {
  const who = input.audience || "the site's customers";
  const brandLine = input.brand ? `Brand: ${input.brand}. ` : "";
  const voiceLine = input.voice ? `Voice: ${input.voice}. ` : "Voice: clear and specific. ";
  const site = input.url ? `URL: ${input.url}. ` : "";
  const shapes: Record<Job, string> = {
    brief: '{"title":"","idea":"","audience":"","tension":"","promise":"","proof":"","channels":[]}',
    landing: '{"headline":"","subhead":"","problem":"","offer":"","proof_points":[],"cta":""}',
    seo: '{"title":"","description":"","h1":"","outline":[]}',
    social: '{"posts":[{"channel":"","hook":"","body":"","cta":""}]}',
    framework: '{"framework":"","blocks":{},"hook":"","body":"","cta":""}',
  };
  let extra = "";
  if (input.job === "framework") extra = ` Use the ${input.framework} framework. blocks keys must match that framework.`;
  if (input.job === "seo") extra = " title under 60 characters, description under 160.";
  if (input.job === "social") extra = " Write three posts. Do not claim results you were not given.";
  return `${HONESTY}\n${brandLine}${voiceLine}${site}Audience: ${who}. Offer: ${input.offer}. Channel: ${input.channel}.${extra}\nReturn JSON in this shape: ${shapes[input.job]}`;
}

export async function completeDsh(model: string, messages: ChatMessage[], env: Env = readEnv()): Promise<string> {
  if (!env.deepseekKey) throw new Error("DEEPSEEK_API_KEY is not set");
  const response = await fetch(`${env.deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.deepseekKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.4 }),
  });
  if (!response.ok) throw new Error(`DeepSeek request failed (${response.status})`);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("DeepSeek returned an unexpected reply");
  return text;
}

export async function completeOllama(model: string, messages: ChatMessage[], env: Env = readEnv()): Promise<string> {
  if (!env.ollamaKey) throw new Error("OLLAMA_API_KEY is not set");
  const response = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.ollamaKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!response.ok) throw new Error(`Ollama Cloud request failed (${response.status})`);
  const data = (await response.json()) as { message?: { content?: string } };
  const text = data.message?.content?.trim();
  if (!text) throw new Error("Ollama Cloud returned an unexpected reply");
  return text;
}

export async function generate(
  input: {
    job: string;
    offer: string;
    audience?: string;
    brand?: string;
    voice?: string;
    framework?: string;
    channel?: string;
    url?: string;
    provider?: string;
    model?: string | null;
    quality?: Quality;
  },
  deps?: { env?: Env; completeDsh?: Completer; completeOllama?: Completer },
) {
  const offer = (input.offer || "").trim();
  if (!offer) throw new Error("offer is required");
  const framework = (input.framework || "pas").trim().toLowerCase();
  if (input.job === "framework" && !FRAMEWORKS.includes(framework as (typeof FRAMEWORKS)[number])) {
    throw new Error(`framework must be one of ${[...FRAMEWORKS].sort().join(", ")}`);
  }
  const env = deps?.env ?? readEnv();
  let route = resolveRoute(input.job, input.provider || "auto", input.model, input.quality || "good", env);
  const messages: ChatMessage[] = [
    { role: "system", content: `You write honest marketing for a website. ${HONESTY}` },
    {
      role: "user",
      content: prompt({
        job: route.job,
        offer,
        audience: input.audience || "",
        brand: input.brand || "",
        voice: input.voice || "",
        framework,
        channel: input.channel || "meta_facebook",
        url: input.url || "",
      }),
    },
  ];
  const dsh = deps?.completeDsh ?? ((model, msgs) => completeDsh(model, msgs, env));
  const cloud = deps?.completeOllama ?? ((model, msgs) => completeOllama(model, msgs, env));
  let fallbackFrom = "";
  let raw: string;
  try {
    raw = route.provider === "dsh" ? await dsh(route.model, messages) : await cloud(route.model, messages);
  } catch (error) {
    const forced = (input.provider || "auto") === "dsh";
    if (route.provider !== "dsh" || forced) throw error;
    fallbackFrom = "dsh";
    route = { provider: "ollama_cloud", model: env.ollamaQualityModel, job: route.job };
    raw = await cloud(route.model, messages);
  }
  const output: {
    job: Job;
    route: { provider: string; model: string; fallback_from?: string; reason?: string };
    output: Record<string, unknown>;
  } = { job: route.job, route: { provider: route.provider, model: route.model }, output: extractJson(raw) };
  if (fallbackFrom) {
    output.route.fallback_from = fallbackFrom;
    output.route.reason = "DeepSeek key missing or the harness route failed; used Ollama Cloud";
  }
  return output;
}

export function scoreCopy(input: { hook?: string; body?: string; cta?: string; banned?: string[] }) {
  const hook = input.hook || "";
  const body = input.body || "";
  const cta = input.cta || "";
  const text = `${hook} ${body} ${cta}`.trim();
  const lower = text.toLowerCase();
  let score = 50;
  const reasons: string[] = [];
  const flags: string[] = [];
  if (hook && hook.length >= 8 && hook.length <= 80) {
    score += 12;
    reasons.push("hook length is in the scan band");
  } else if (hook) {
    score -= 5;
    flags.push("hook is too short or too long");
  } else {
    score -= 15;
    flags.push("missing hook");
  }
  if (cta && cta.length <= 40) {
    score += 10;
    reasons.push("CTA is short");
  } else {
    score -= 8;
    flags.push("weak or missing CTA");
  }
  if (body && body.length >= 40 && body.length <= 500) {
    score += 10;
    reasons.push("body length fits a page or feed");
  } else if (!body) {
    score -= 10;
    flags.push("missing body");
  }
  const hits = (input.banned || []).filter((word) => word && lower.includes(word.toLowerCase()));
  if (hits.length) {
    score -= 20;
    flags.push(`banned claim: ${hits.join(", ")}`);
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    label: "heuristic pre-launch score, not measured performance",
    reasons,
    flags,
  };
}

export function placementPack(platform: string, input: { hook?: string; body?: string; cta?: string } = {}) {
  const name = (platform || "meta").trim().toLowerCase();
  const specs = PLACEMENTS[name];
  if (!specs) throw new Error(`platform must be one of ${Object.keys(PLACEMENTS).sort().join(", ")}`);
  const hook = input.hook || "";
  const body = input.body || "";
  return {
    platform: name,
    placements: specs.map((spec) => ({
      ...spec,
      hook: spec.placement === "rsa_headlines" ? hook.slice(0, 30) : hook,
      body: spec.placement === "rsa_descriptions" ? body.slice(0, 90) : body,
      cta: input.cta || "",
    })),
    note: "Export pack only. Nothing is published.",
  };
}
