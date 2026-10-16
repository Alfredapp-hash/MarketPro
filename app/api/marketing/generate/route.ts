import { generate } from "@/lib/marketing/suite";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.offer !== "string" || typeof body.job !== "string") {
    return Response.json({ error: "job and offer are required" }, { status: 400 });
  }
  const quality = body.quality === "low" ? "low" : "good";
  try {
    const result = await generate({
      job: body.job,
      offer: body.offer,
      audience: typeof body.audience === "string" ? body.audience : "",
      brand: typeof body.brand === "string" ? body.brand : "",
      voice: typeof body.voice === "string" ? body.voice : "",
      framework: typeof body.framework === "string" ? body.framework : "pas",
      channel: typeof body.channel === "string" ? body.channel : "site",
      url: typeof body.url === "string" ? body.url : "",
      provider: typeof body.provider === "string" ? body.provider : "auto",
      model: typeof body.model === "string" ? body.model : null,
      quality,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    const status = /required|must be one of/.test(message) ? 400 : 503;
    return Response.json({ error: message }, { status });
  }
}
