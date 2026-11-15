import { loadCatalogue } from "@/app/catalogue";
import { matchCareer } from "@/lib/ai/career";
import { complete, hasModel } from "@/lib/ai/client";

export async function GET() {
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "The body must be JSON." }, { status: 400 });
  }
  const result = await matchCareer(raw, loadCatalogue().programs, hasModel() ? complete : null);
  return Response.json(result.body, { status: result.status });
}
