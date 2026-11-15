import { loadCatalogue } from "@/app/catalogue";
import { answerChat } from "@/lib/ai/chat";
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
  const catalogue = loadCatalogue();
  const result = await answerChat(
    raw,
    {
      programs: catalogue.programs,
      courses: catalogue.courses,
      policyRules: catalogue.policyRules,
      transferRules: catalogue.transferRules,
    },
    hasModel() ? complete : null,
  );
  return Response.json(result.body, { status: result.status });
}
