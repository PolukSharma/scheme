export interface ModelTurn {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type ModelFn = (input: { system: string; user: string }) => Promise<ModelTurn | null>;

/** True only when a key is present. The key is read here and is not returned. */
export function hasModel(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

/**
 * One provider call. Swap this function to change provider.
 * Uses an OpenAI-compatible chat completion. No embeddings.
 * Returns null when the key is missing, the provider errors, or the body is empty.
 */
export async function complete(input: { system: string; user: string }): Promise<ModelTurn | null> {
  const key = process.env.AI_API_KEY?.trim();
  if (!key) return null;
  const base = (process.env.AI_API_BASE?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const choice = (payload as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
    if (typeof choice !== "string" || choice.trim().length === 0) return null;
    const usage = (payload as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage;
    return {
      text: choice,
      inputTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : 0,
      outputTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : 0,
    };
  } catch {
    return null;
  }
}
