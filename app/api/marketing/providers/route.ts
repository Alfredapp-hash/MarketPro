import { catalog } from "@/lib/marketing/suite";

export function GET() {
  return Response.json(catalog());
}
