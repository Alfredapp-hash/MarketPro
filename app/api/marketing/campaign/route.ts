import { runCampaign } from "@/lib/marketing/campaign";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.offer !== "string") {
    return Response.json({ error: "offer is required" }, { status: 400 });
  }
  const brand = (body.brand || {}) as Record<string, unknown>;
  const quality = body.quality === "low" ? "low" : "good";
  try {
    const campaign = await runCampaign({
      offer: body.offer,
      provider: typeof body.provider === "string" ? body.provider : "auto",
      quality,
      model: typeof body.model === "string" ? body.model : null,
      start: typeof body.start === "string" ? body.start : undefined,
      brand: {
        name: typeof brand.name === "string" ? brand.name : "",
        voice: typeof brand.voice === "string" ? brand.voice : "",
        audience: typeof brand.audience === "string" ? brand.audience : "",
        url: typeof brand.url === "string" ? brand.url : "",
        proof: typeof brand.proof === "string" ? brand.proof : "",
        banned: Array.isArray(brand.banned) ? brand.banned.map(String) : [],
      },
    });
    return Response.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign failed";
    const status = /required|must be one of/.test(message) ? 400 : 503;
    return Response.json({ error: message }, { status });
  }
}
