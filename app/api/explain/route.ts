import { loadCatalogue } from "@/app/catalogue";
import { complete, hasModel } from "@/lib/ai/client";
import { explainOpportunity } from "@/lib/ai/explain";

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
  const catalogue = loadCatalogue();
  const result = await explainOpportunity(
    raw,
    catalogue.programs,
    catalogue.courses,
    catalogue.policyRules,
    hasModel() ? complete : null,
  );
  return Response.json(result.body, { status: result.status });
}
