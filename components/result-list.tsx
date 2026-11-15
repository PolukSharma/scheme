import { CrossSchoolAlert } from "@/components/cross-school";
import { verificationLabel } from "@/components/rank-student";
import type { Opportunity, Program } from "@/lib/types";

function formatCount(value: number): string {
  return String(value);
}

export function ResultList({
  rows,
  programs,
  modeLabel,
  onOpen,
}: {
  rows: readonly Opportunity[];
  programs: readonly Program[];
  modeLabel: string;
  onOpen: (item: Opportunity) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="banner" role="status">
        No program of this type is in the {modeLabel} list.
      </p>
    );
  }
  return (
    <div className="stack">
      {rows.map((item) => {
        const program = programs.find((entry) => entry.id === item.programId);
        const label = verificationLabel(item.verified);
        return (
          <article className="card" key={`${item.mode}-${item.programId}`}>
            <header className="card-head">
              <h3>{program?.name ?? item.programId}</h3>
              <p className="meta">
                {program?.kind ?? "program"} · {program?.school ?? "School not on file"} · {label}
              </p>
            </header>
            <div className="stats">
              <p>
                <span className="stat-num">{formatCount(item.extraTerms)}</span>
                <span className="stat-label">extra terms</span>
              </p>
              <p>
                <span className="stat-num">{formatCount(item.extraUnits)}</span>
                <span className="stat-label">extra units</span>
              </p>
            </div>
            <p>{item.bindingConstraint}</p>
            {item.mode === "switch" ? (
              <p className="meta">A negative number is fewer terms or units than the current major.</p>
            ) : null}
            <CrossSchoolAlert item={item} />
            <button type="button" onClick={() => onOpen(item)}>
              Open {program?.name ?? "this program"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
