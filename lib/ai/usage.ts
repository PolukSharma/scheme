interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  guardRejections: number;
}

const totals: UsageTotals = {
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  guardRejections: 0,
};

/** Counts only. The question and the catalogue text are never written here. */
export function recordUsage(
  route: "career" | "chat" | "explain",
  inputTokens: number,
  outputTokens: number,
  guardRejections: number,
): void {
  totals.requests += 1;
  totals.inputTokens += inputTokens;
  totals.outputTokens += outputTokens;
  totals.guardRejections += guardRejections;
  console.info(
    `scheme-ai route=${route} inputTokens=${inputTokens} outputTokens=${outputTokens} guardRejections=${guardRejections}`,
  );
}

export function averageTokensPerRequest(): number {
  if (totals.requests === 0) return 0;
  return (totals.inputTokens + totals.outputTokens) / totals.requests;
}

export function usageSnapshot(): UsageTotals {
  return { ...totals };
}

export function resetUsage(): void {
  totals.requests = 0;
  totals.inputTokens = 0;
  totals.outputTokens = 0;
  totals.guardRejections = 0;
}
