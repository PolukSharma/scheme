import type { Ref } from "react";
import { advisorQuestions, indexRequirements, uniqueAssumptions, verificationLabel } from "@/components/rank-student";
import { SchemeWord } from "@/components/scheme-word";
import type { AuditResult, Opportunity, Program, RequirementNode, StudentRecord, TermPlan } from "@/lib/types";

function courseList(codes: readonly string[]): string {
  if (codes.length === 0) return "None";
  return codes.join(", ");
}

function unverifiedTexts(program: Program, nodes: ReadonlyMap<string, RequirementNode>, resultVerified: boolean): string[] {
  const lines: string[] = [];
  if (!program.verified) lines.push(`${program.name} is unverified in the catalogue record.`);
  if (!resultVerified) lines.push("The engine marked this result unverified.");
  const seen = new Set<string>();
  for (const node of nodes.values()) {
    if (node.verified || seen.has(node.source.text)) continue;
    seen.add(node.source.text);
    lines.push(node.source.text);
  }
  return lines;
}

export function AdvisorSheet({
  student,
  major,
  opportunity,
  program,
  audit,
  plan,
  name,
  headingRef,
}: {
  student: StudentRecord;
  major: Program;
  opportunity: Opportunity | null;
  program: Program;
  audit: AuditResult;
  plan: TermPlan;
  name: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const nodes = indexRequirements(program.requirements);
  const resultVerified = opportunity ? opportunity.verified : program.verified;
  const unverified = unverifiedTexts(program, nodes, opportunity ? opportunity.verified : program.verified);
  const assumptions = uniqueAssumptions([audit, opportunity ?? { assumptions: [] }, plan]);
  const questions = advisorQuestions({
    unverified: unverified.length > 0 || !resultVerified,
    crossSchool: opportunity?.crossSchool ?? false,
    assumptionCount: assumptions.length,
  });
  const typedName = name.trim();

  return (
    <article className="advisor-sheet">
      <h1 tabIndex={-1} ref={headingRef}>
        <SchemeWord /> advisor copy
      </h1>
      {typedName ? <p>Name: {typedName}</p> : null}
      <p>STARS remains the official audit. This is a planning aid and it does not replace an advisor.</p>
      <h2>Current standing</h2>
      <p>
        {major.name} · started {student.startTerm} · catalogue {student.catalogueYear} · {student.school}
      </p>
      <ul>
        {student.courses.map((course) => (
          <li key={`${course.code}-${course.term ?? "none"}-${course.status}`}>
            {course.code} · {course.units} units · {course.status.replaceAll("_", " ")}
            {course.grade ? ` · ${course.grade}` : ""} · {course.term ?? "no term"}
          </li>
        ))}
      </ul>
      <h2>Chosen program</h2>
      {opportunity ? (
        <p>
          {program.name} · {opportunity.mode === "add_on" ? "add on" : "switch"} · {verificationLabel(opportunity.verified)} ·{" "}
          {opportunity.extraTerms} {opportunity.mode === "switch" ? "change in terms" : "extra terms"} · {opportunity.extraUnits}{" "}
          {opportunity.mode === "switch" ? "change in units" : "extra units"}
        </p>
      ) : (
        <p>
          {program.name} · current major · {program.verified ? "Verified" : "Unverified"}
        </p>
      )}
      <p>{opportunity ? opportunity.bindingConstraint : "No add-on or switch is selected. This copy is the current major."}</p>
      <h2>Plan by term</h2>
      {plan.terms.length === 0 ? <p>The engine plan has no further terms.</p> : null}
      <ol>
        {plan.terms.map((term) => (
          <li key={term.label}>
            {term.label} · {term.units} units
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
      <h2>Courses that count</h2>
      <p>{courseList(opportunity?.coursesThatCount ?? audit.requirements.flatMap((item) => item.appliedCourses))}</p>
      {opportunity && opportunity.coursesThatStopCounting.length > 0 ? (
        <p>Would stop counting: {courseList(opportunity.coursesThatStopCounting)}</p>
      ) : null}
      <h2>Requirements</h2>
      <ul>
        {audit.requirements.map((status) => {
          const node = nodes.get(status.nodeId);
          return (
            <li key={status.nodeId}>
              <p>{status.source.text}</p>
              <p>
                {status.satisfied ? "The engine marks this satisfied." : "The engine marks this open."} {status.note} Applied:{" "}
                {courseList(status.appliedCourses)}. Remaining units: {status.remainingUnits}.{" "}
                {node ? verificationLabel(node.verified) : "Unverified"}
              </p>
              <p>
                <a href={status.source.url}>
                  Catalogue, {status.source.catalogueYear}
                </a>
              </p>
            </li>
          );
        })}
      </ul>
      <h2>Cross-school requirements</h2>
      {opportunity?.crossSchool ? (
        opportunity.transfer ? (
          <>
            <p>{opportunity.transfer.rule.summary}</p>
            <p>Has: {courseList(opportunity.transfer.prerequisitesHave)}</p>
            <p>Lacks: {courseList(opportunity.transfer.prerequisitesLack)}</p>
            <p>
              <a href={opportunity.transfer.rule.source.url}>Official page for this school</a>
            </p>
            <p>This is not a prediction of admission.</p>
          </>
        ) : (
          <p>The schools differ and no transfer rule is on file. This is not a prediction of admission.</p>
        )
      ) : (
        <p>The chosen program is in the same school as the record.</p>
      )}
      <h2>Unverified items</h2>
      {unverified.length === 0 ? <p>None.</p> : (
        <ul>
          {unverified.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <h2>Assumptions</h2>
      {assumptions.length === 0 ? <p>None.</p> : (
        <ul>
          {assumptions.map((assumption) => (
            <li key={`${assumption.ruleId}-${assumption.text}`}>{assumption.text}</li>
          ))}
        </ul>
      )}
      <h2>Questions for the advisor</h2>
      <ol>
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ol>
      <p>STARS remains the official audit.</p>
    </article>
  );
}
