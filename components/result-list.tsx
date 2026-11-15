import { CrossSchoolAlert } from "@/components/cross-school";
import { estimatedCostLabel, verificationLabel } from "@/components/rank-student";
import type { Opportunity, PolicyRule, Program } from "@/lib/types";

function formatCount(value: number): string {
  return String(value);
}

export function ResultList({
  rows,
  programs,
  policyRules,
  modeLabel,
  onOpen,
}: {
  rows: readonly Opportunity[];
  programs: readonly Program[];
  policyRules: readonly PolicyRule[];
  modeLabel: string;
  onOpen: (item: Opportunity) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="banner" role="status">
        No program matches these filters in the {modeLabel} list.
      </p>
    );
  }
  return (
    <div className="stack">
      {rows.map((item) => {
        const program = programs.find((entry) => entry.id === item.programId);
        const label = verificationLabel(item.verified);
        const headingId = `result-${item.mode}-${item.programId}`;
        return (
          <article className="card" key={`${item.mode}-${item.programId}`} aria-labelledby={headingId}>
            <header className="card-head">
              <h3 id={headingId}>{program?.name ?? item.programId}</h3>
              <p className="meta">
                {program?.kind ?? "program"} · {program?.school ?? "School not on file"}
              </p>
              <p>
                <span className={item.verified ? "badge badge-verified" : "badge"}>{label}</span>
              </p>
            </header>
            <CrossSchoolAlert item={item} headingId={`cross-${item.mode}-${item.programId}`} />
            <div className="stats">
              <p>
                <span className="stat-num">{formatCount(item.extraUnits)}</span>
                <span className="stat-label">extra units</span>
              </p>
              <p>
                <span className="stat-num">{formatCount(item.extraTerms)}</span>
                <span className="stat-label">extra terms</span>
              </p>
              <p className="cost-line">
                <span className="stat-label">Estimated cost</span>{" "}
                <strong>{estimatedCostLabel(policyRules, item.extraUnits)}</strong>
              </p>
            </div>
            <p className="why">Why: {item.bindingConstraint}</p>
            {item.mode === "switch" ? (
              <p className="meta">A negative number is fewer terms or units than the current major.</p>
            ) : null}
            <button type="button" onClick={() => onOpen(item)}>
              Open {program?.name ?? "this program"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
