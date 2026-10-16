import { scoreCopy } from "@/lib/marketing/suite";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    hook?: string;
    body?: string;
    cta?: string;
    banned?: string[];
  };
  return Response.json(
    scoreCopy({
      hook: body.hook || "",
      body: body.body || "",
      cta: body.cta || "",
      banned: Array.isArray(body.banned) ? body.banned : [],
    }),
  );
}
