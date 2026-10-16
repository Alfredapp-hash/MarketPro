import { placementPack } from "@/lib/marketing/suite";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    platform?: string;
    hook?: string;
    body?: string;
    cta?: string;
  };
  try {
    return Response.json(placementPack(body.platform || "meta", body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Placement pack failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
