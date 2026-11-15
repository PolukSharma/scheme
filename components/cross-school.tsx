import type { Opportunity } from "@/lib/types";

function courseList(codes: readonly string[]): string {
  if (codes.length === 0) return "None";
  return codes.join(", ");
}

export function CrossSchoolAlert({ item }: { item: Opportunity }) {
  if (!item.crossSchool) return null;
  return (
    <aside className="alert" aria-label="Different school">
      <h4>Different school</h4>
      {item.transfer ? (
        <>
          <p>{item.transfer.rule.summary}</p>
          {item.transfer.rule.gpaText ? <p>{item.transfer.rule.gpaText}</p> : null}
          {item.transfer.rule.timingText ? <p>{item.transfer.rule.timingText}</p> : null}
          {item.transfer.rule.applicationSteps.length > 0 ? (
            <ol>
              {item.transfer.rule.applicationSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          <p>Prerequisite courses the record has: {courseList(item.transfer.prerequisitesHave)}.</p>
          <p>Prerequisite courses the record lacks: {courseList(item.transfer.prerequisitesLack)}.</p>
          <p>
            <a href={item.transfer.rule.source.url}>Official page for this school</a>
            <span className="meta"> · checked {item.transfer.rule.dateChecked}</span>
          </p>
        </>
      ) : (
        <p>No transfer rule is on file for this school.</p>
      )}
      <p>This is not a prediction of admission.</p>
    </aside>
  );
}
