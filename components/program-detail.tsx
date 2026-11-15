"use client";

import { useEffect, useState } from "react";
import { CrossSchoolAlert } from "@/components/cross-school";
import { estimatedCostLabel, indexRequirements, uniqueAssumptions, verificationLabel } from "@/components/rank-student";
import { postOpportunity } from "@/lib/ai/opportunity";
import { chatAnswerSchema, type AuditResult, type ChatAnswer, type Course, type Opportunity, type PolicyRule, type Program, type StudentRecord, type TermPlan } from "@/lib/types";

function findCourse(courses: readonly Course[], code: string): Course | undefined {
  return courses.find((course) => course.code === code);
}

function statusLabel(status: StudentRecord["courses"][number]["status"]): string {
  if (status === "in_progress") return "In progress";
  if (status === "transfer") return "Transfer";
  if (status === "ap") return "AP";
  return "Completed";
}

export function ProgramDetail({
  program,
  opportunity,
  audit,
  plan,
  courses,
  student,
  policyRules,
  onPdf,
  onBack,
}: {
  program: Program;
  opportunity: Opportunity | null;
  audit: AuditResult;
  plan: TermPlan;
  courses: readonly Course[];
  student: StudentRecord;
  policyRules: readonly PolicyRule[];
  onPdf: () => void;
  onBack: () => void;
}) {
  const nodes = indexRequirements(program.requirements);
  const counted = [...new Set(opportunity?.coursesThatCount ?? [])];
  const countedSet = new Set(counted);
  const completed = counted.filter((code) => {
    const onRecord = student.courses.find((course) => course.code === code);
    return onRecord !== undefined && onRecord.status !== "in_progress";
  });
  const inProgress = student.courses.filter((course) => course.status === "in_progress" && countedSet.has(course.code));
  const remaining = opportunity?.remainingCourses ?? audit.coursesRemaining;

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
          <span className={program.verified ? "badge badge-verified" : "badge"}>{verificationLabel(program.verified)}</span>
        </p>
        <p>
          <a href={program.source.url}>Catalogue page, {program.catalogueYear}</a>
        </p>
        {opportunity ? (
          <p>
            {opportunity.extraUnits} extra units · {opportunity.extraTerms} extra terms · Estimated cost{" "}
            {estimatedCostLabel(policyRules, opportunity.extraUnits)}. {opportunity.bindingConstraint}
          </p>
        ) : null}
        {opportunity ? <Explanation opportunity={opportunity} /> : null}
        {opportunity ? <CrossSchoolAlert item={opportunity} headingId={`detail-cross-${opportunity.programId}`} /> : null}
        {opportunity && opportunity.mode === "switch" ? (
          <>
            <h3>Would stop counting</h3>
            {opportunity.coursesThatStopCounting.length === 0 ? (
              <p>No completed course would stop counting.</p>
            ) : (
              <ul>
                {opportunity.coursesThatStopCounting.map((code) => {
                  const course = findCourse(courses, code);
                  return (
                    <li key={code}>
                      {code}
                      {course ? ` ${course.title}` : ""}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </section>
      <section aria-labelledby="why-heading">
        <h2 id="why-heading">Why this counts</h2>
        {completed.length === 0 ? (
          <p className="banner" role="status">
            No completed course on this record counts toward this program yet.
          </p>
        ) : (
          <ul className="stack">
            {completed.map((code) => {
              const course = findCourse(courses, code);
              const onRecord = student.courses.find((item) => item.code === code);
              return (
                <li className="card" key={code}>
                  <p>
                    {code}
                    {course ? ` ${course.title}` : ""}
                    {course ? ` · ${course.units} units` : ""}
                    {onRecord ? ` · ${statusLabel(onRecord.status)}` : ""}
                  </p>
                  <p>It counts toward {program.name}.</p>
                  {course ? (
                    <p>
                      <a href={course.source.url}>
                        Catalogue, {course.source.catalogueYear}
                      </a>
                    </p>
                  ) : (
                    <p>This course is not in the course list.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {inProgress.length > 0 ? (
          <p>
            In progress, and counted only where the requirement has no minimum grade: {inProgress.map((course) => course.code).join(", ")}.
          </p>
        ) : null}
      </section>
      <section aria-labelledby="remaining-heading">
        <h2 id="remaining-heading">Still to take</h2>
        {remaining.length === 0 ? (
          <p className="banner" role="status">
            No courses remain on this path.
          </p>
        ) : (
          <ul className="stack">
            {remaining.map((code) => {
              const course = findCourse(courses, code);
              return (
                <li className="card" key={code}>
                  {course ? (
                    <p>
                      <a href={course.source.url}>
                        {code} {course.title} ({course.units} units), Catalogue {course.source.catalogueYear}
                      </a>
                    </p>
                  ) : (
                    <p>
                      {code}. This course is not in the course list.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
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
                  <p>Applied courses: {status.appliedCourses.length === 0 ? "None" : status.appliedCourses.join(", ")}</p>
                  <p>Remaining units: {status.remainingUnits}</p>
                  <p>
                    <span className={node?.verified ? "badge badge-verified" : "badge"}>{node ? verificationLabel(node.verified) : "Unverified"}</span>
                  </p>
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
        <h2 id="plan-heading">Term-by-term plan</h2>
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
                  {term.courses.map((course) => {
                    const listed = findCourse(courses, course.code);
                    return (
                      <li key={course.code}>
                        {listed ? (
                          <a href={listed.source.url}>
                            {course.code} {course.title} ({course.units} units)
                          </a>
                        ) : (
                          <>
                            {course.code} {course.title} ({course.units} units)
                          </>
                        )}
                      </li>
                    );
                  })}
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

function Explanation({ opportunity }: { opportunity: Opportunity }) {
  const [route, setRoute] = useState<"checking" | "up" | "down">("checking");
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/explain")
      .then((response) => {
        if (!cancelled) setRoute(response.status === 404 ? "down" : "up");
      })
      .catch(() => {
        if (!cancelled) setRoute("down");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function explain() {
    setBusy(true);
    setNote(null);
    setAnswer(null);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunity: postOpportunity(opportunity) }),
      });
      if (!response.ok) {
        setNote("The explanation did not answer. The numbers above are the engine result.");
        return;
      }
      const payload: unknown = await response.json();
      const parsed = chatAnswerSchema.safeParse(payload);
      if (!parsed.success) {
        setNote("The explanation did not return sentences the page could show. The numbers above are the engine result.");
        return;
      }
      setAnswer(parsed.data);
    } catch {
      setRoute("down");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="explain-heading">
      <h3 id="explain-heading">Explanation</h3>
      <p className="meta">Two or three sentences from the computed result. A course, a number, or a program name that was not in that result is dropped.</p>
      {route === "checking" ? <p role="status">Checking whether an explanation is available.</p> : null}
      {route === "down" ? (
        <p className="banner" role="status">
          Explanation is unavailable. The numbers above are the engine result.
        </p>
      ) : null}
      {route === "up" ? (
        <>
          <button type="button" onClick={() => void explain()} disabled={busy}>
            {busy ? "Explaining…" : "Explain this result"}
          </button>
          {note ? <p role="status">{note}</p> : null}
          {answer ? (
            <div>
              <p>{answer.text}</p>
              {answer.fallback ? <p className="meta">Engine-only explanation.</p> : null}
              {answer.citations.length > 0 ? (
                <ul>
                  {answer.citations.map((citation) => (
                    <li key={`${citation.label}-${citation.source.url}`}>
                      <a href={citation.source.url}>
                        {citation.label}, {citation.source.catalogueYear}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
