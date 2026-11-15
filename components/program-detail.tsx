import { CrossSchoolAlert } from "@/components/cross-school";
import { indexRequirements, uniqueAssumptions, verificationLabel } from "@/components/rank-student";
import type { AuditResult, Opportunity, Program, TermPlan } from "@/lib/types";

function courseList(codes: readonly string[]): string {
  if (codes.length === 0) return "None";
  return codes.join(", ");
}

export function ProgramDetail({
  program,
  opportunity,
  audit,
  plan,
  onPdf,
  onBack,
}: {
  program: Program;
  opportunity: Opportunity | null;
  audit: AuditResult;
  plan: TermPlan;
  onPdf: () => void;
  onBack: () => void;
}) {
  const nodes = indexRequirements(program.requirements);
  return (
    <div className="stack">
      <p>
        <button type="button" onClick={onBack}>
          Back to results
        </button>
      </p>
      <section className="card" aria-labelledby="detail-heading">
        <h2 id="detail-heading">{program.name}</h2>
        <p className="meta">
          {program.kind} · {program.school} · catalogue record {verificationLabel(program.verified)}
          {opportunity ? ` · engine result ${verificationLabel(opportunity.verified)}` : ""}
        </p>
        <p>
          <a href={program.source.url}>Catalogue page, {program.catalogueYear}</a>
        </p>
        {opportunity ? (
          <p>
            {opportunity.extraTerms} extra terms · {opportunity.extraUnits} extra units. {opportunity.bindingConstraint}
          </p>
        ) : null}
        {opportunity ? <CrossSchoolAlert item={opportunity} /> : null}
        <h3>Courses that count</h3>
        <p>{courseList(opportunity?.coursesThatCount ?? [])}</p>
        {opportunity && opportunity.mode === "switch" ? (
          <>
            <h3>Would stop counting</h3>
            <p>{courseList(opportunity.coursesThatStopCounting)}</p>
          </>
        ) : null}
        <h3>Still to take</h3>
        <p>{courseList(opportunity?.remainingCourses ?? audit.coursesRemaining)}</p>
      </section>
      <section aria-labelledby="requirements-heading">
        <h2 id="requirements-heading">Requirements</h2>
        {audit.requirements.length === 0 ? (
          <p className="banner" role="status">
            The engine returned no requirement rows.
          </p>
        ) : (
          <ul className="stack">
            {audit.requirements.map((status) => {
              const node = nodes.get(status.nodeId);
              return (
                <li className="card" key={status.nodeId}>
                  <p>{status.source.text}</p>
                  <p>
                    {status.satisfied ? "The engine marks this satisfied." : "The engine marks this open."} {status.note}
                  </p>
                  <p>Applied courses: {courseList(status.appliedCourses)}</p>
                  <p>Remaining units: {status.remainingUnits}</p>
                  <p>{node ? verificationLabel(node.verified) : "Unverified"}</p>
                  <p>
                    <a href={status.source.url}>Catalogue, {status.source.catalogueYear}</a>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-labelledby="assumptions-heading">
        <h2 id="assumptions-heading">Assumptions</h2>
        {uniqueAssumptions([audit, opportunity ?? { assumptions: [] }, plan]).length === 0 ? (
          <p className="banner" role="status">
            The engine returned no assumptions.
          </p>
        ) : (
          <ul>
            {uniqueAssumptions([audit, opportunity ?? { assumptions: [] }, plan]).map((assumption) => (
              <li key={`${assumption.ruleId}-${assumption.text}`}>{assumption.text}</li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="plan-heading">
        <h2 id="plan-heading">Term plan</h2>
        {plan.terms.length === 0 ? (
          <p className="banner" role="status">
            The engine plan has no further terms.
          </p>
        ) : (
          <ol className="plan">
            {plan.terms.map((term) => (
              <li key={term.label}>
                <h3>{term.label}</h3>
                <p className="meta">{term.units} units</p>
                <ul>
                  {term.courses.map((course) => (
                    <li key={course.code}>
                      {course.code} {course.title} ({course.units} units)
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
      <p>
        <button type="button" className="primary" onClick={onPdf}>
          Advisor PDF
        </button>
      </p>
    </div>
  );
}
