import { FRAMEWORKS, generate, placementPack, scoreCopy, type Completer, type Env, type Quality } from "./suite";

const VARIANT_FRAMEWORKS = ["pas", "aida", "bab"] as const;
const PLATFORMS = ["meta", "google", "linkedin", "tiktok"] as const;

export type Brand = {
  name: string;
  voice: string;
  audience: string;
  url: string;
  proof: string;
  banned: string[];
};

export type Variant =
  | { framework: string; error: string }
  | {
      framework: string;
      route: { provider: string; model: string; fallback_from?: string; reason?: string };
      hook: string;
      body: string;
      cta: string;
      score: number;
      label: string;
      reasons: string[];
      flags: string[];
    };

export type CampaignInput = {
  offer: string;
  brand?: Partial<Brand>;
  provider?: string;
  quality?: Quality;
  model?: string | null;
  start?: string;
};

type GenerateResult = Awaited<ReturnType<typeof generate>>;

export type SectionResult<T> = { ok: true; value: T } | { ok: false; error: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBrand(raw: Partial<Brand> | undefined): Brand {
  const banned = Array.isArray(raw?.banned) ? raw.banned.map((item) => String(item).trim()).filter(Boolean) : [];
  return {
    name: (raw?.name || "").trim(),
    voice: (raw?.voice || "").trim(),
    audience: (raw?.audience || "").trim(),
    url: (raw?.url || "").trim(),
    proof: (raw?.proof || "").trim(),
    banned,
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Generation failed";
}

async function section<T>(work: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export function scorePiece(hook: string, body: string, cta: string, banned: string[]) {
  return { hook, body, cta, ...scoreCopy({ hook, body, cta, banned }) };
}

export function pickLead<T extends { score: number }>(variants: T[]): T | null {
  if (!variants.length) return null;
  return [...variants].sort((a, b) => b.score - a.score)[0];
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildCalendar(
  start: string,
  posts: { channel: string; hook: string; body: string }[],
  landingCta: string,
) {
  const items: { date: string; channel: string; title: string; copy: string }[] = [];
  if (landingCta) {
    items.push({ date: start, channel: "site", title: "Publish the landing page", copy: landingCta });
  }
  posts.forEach((post, index) => {
    const day = 1 + index * 2;
    if (day > 13 || !post.hook) return;
    items.push({
      date: addDays(start, day),
      channel: post.channel || "social",
      title: post.hook,
      copy: post.body,
    });
  });
  return items;
}

export async function runCampaign(
  input: CampaignInput,
  deps?: { env?: Env; completeDsh?: Completer; completeOllama?: Completer },
) {
  const offer = (input.offer || "").trim();
  if (!offer) throw new Error("offer is required");
  const brand = normalizeBrand(input.brand);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(input.start || "") ? input.start! : new Date().toISOString().slice(0, 10);
  const shared = {
    offer,
    audience: brand.audience,
    brand: brand.name,
    voice: brand.voice,
    url: brand.url,
    proof: brand.proof,
    banned: brand.banned,
    provider: input.provider || "auto",
    quality: input.quality || "good",
    model: input.model,
  };

  const [brief, landing, seo, social, ...variants] = await Promise.all([
    section(() => generate({ ...shared, job: "brief", channel: "site" }, deps)),
    section(() => generate({ ...shared, job: "landing", channel: "site" }, deps)),
    section(() => generate({ ...shared, job: "seo", channel: "site" }, deps)),
    section(() => generate({ ...shared, job: "social", channel: "social" }, deps)),
    ...VARIANT_FRAMEWORKS.map((framework) =>
      section(() => generate({ ...shared, job: "framework", framework, channel: "site" }, deps)),
    ),
  ]);

  const scoredVariants: Variant[] = [];
  variants.forEach((item, index) => {
    const framework = VARIANT_FRAMEWORKS[index];
    if (!item.ok) {
      scoredVariants.push({ framework, error: item.error });
      return;
    }
    const output = item.value.output;
    const piece = scorePiece(text(output.hook), text(output.body), text(output.cta), brand.banned);
    scoredVariants.push({ framework, route: item.value.route, ...piece });
  });
  const ready = scoredVariants.filter((item): item is Extract<Variant, { score: number }> => "score" in item);
  const lead = pickLead(ready);

  const posts = social.ok && Array.isArray(social.value.output.posts)
    ? social.value.output.posts.map((post) => {
        const row = (post || {}) as Record<string, unknown>;
        const piece = scorePiece(text(row.hook), text(row.body), text(row.cta), brand.banned);
        return { channel: text(row.channel) || "social", ...piece };
      })
    : [];

  const landingCopy = landing.ok
    ? scorePiece(
        text(landing.value.output.headline),
        [text(landing.value.output.subhead), text(landing.value.output.problem)].filter(Boolean).join(" "),
        text(landing.value.output.cta),
        brand.banned,
      )
    : null;

  const source = lead || (landingCopy ? { hook: landingCopy.hook, body: landingCopy.body, cta: landingCopy.cta } : null);
  const placements = source
    ? PLATFORMS.map((platform) => placementPack(platform, source))
    : [];

  return {
    offer,
    brand,
    start,
    brief,
    landing: landing.ok ? { ...landing, score: landingCopy } : landing,
    seo,
    social: social.ok ? { ok: true as const, route: social.value.route, posts } : social,
    variants: scoredVariants,
    lead: lead ? { framework: lead.framework, hook: lead.hook, body: lead.body, cta: lead.cta, score: lead.score } : null,
    placements,
    calendar: buildCalendar(start, posts, landingCopy?.cta || ""),
    frameworks: [...FRAMEWORKS],
  };
}

export type Campaign = Awaited<ReturnType<typeof runCampaign>>;
export type { GenerateResult };
