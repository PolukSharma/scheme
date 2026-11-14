"use client";

import { useState } from "react";
import { SchemeWord } from "@/components/scheme-word";
import type { NamedOpportunity, SampleView } from "@/lib/sample-views";

function courseList(codes: string[]): string {
  if (codes.length === 0) return "None";
  return codes.join(", ");
}

function OpportunityCard({ item }: { item: NamedOpportunity }) {
  return (
    <article className="card">
      <header className="card-head">
        <h3>{item.programName}</h3>
        <p className="meta">
          {item.programKind} · {item.school} · {item.verified ? "Verified" : "Unverified fixture"}
        </p>
      </header>
      <div className="stats">
        <p>
          <span className="stat-num">{item.extraTerms}</span>
          <span className="stat-label">extra terms</span>
        </p>
        <p>
          <span className="stat-num">{item.extraUnits}</span>
          <span className="stat-label">extra units</span>
        </p>
      </div>
      <p>{item.bindingConstraint}</p>
      <dl className="facts">
        <div>
          <dt>Already counts</dt>
          <dd>{courseList(item.coursesThatCount)}</dd>
        </div>
        <div>
          <dt>Still to take</dt>
          <dd>{courseList(item.remainingCourses)}</dd>
        </div>
        {item.mode === "switch" ? (
          <div>
            <dt>Would stop counting</dt>
            <dd>{courseList(item.coursesThatStopCounting)}</dd>
          </div>
        ) : null}
      </dl>
      {item.crossSchool ? (
        <aside className="alert" aria-label="Different school">
          <h4>Different school</h4>
          {item.transfer ? (
            <>
              <p>{item.transfer.rule.summary}</p>
              <p>
                Courses listed there that this sample has: {courseList(item.transfer.prerequisitesHave)}.
                Still missing: {courseList(item.transfer.prerequisitesLack)}.
              </p>
              <p>
                <a href={item.transfer.rule.source.url}>Fixture page for this school</a>
                <span className="meta"> · checked {item.transfer.rule.dateChecked}</span>
              </p>
            </>
          ) : (
            <p>No transfer rule is on file for this school. This does not say anything about admission.</p>
          )}
          <p>This does not say anything about admission.</p>
        </aside>
      ) : null}
    </article>
  );
}

export function HomePlanner({ views }: { views: SampleView[] }) {
  const [studentId, setStudentId] = useState(views[0]?.student.id ?? "");
  const view = views.find((item) => item.student.id === studentId) ?? views[0];

  if (!view) {
    return (
      <main className="wrap">
        <h1>
          <SchemeWord />
        </h1>
        <p className="banner" role="status">
          No sample student is available.
        </p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header className="mast">
        <h1>
          <SchemeWord />
        </h1>
        <p className="lede">
          A planning aid for USC students. Pick a sample student and see stub rankings for invented
          DEMO programs. Nothing here is a USC catalogue rule.
        </p>
      </header>

      <p className="banner">
        STARS remains the official audit. Scheme supports an advisor and does not replace one. This
        skeleton does not upload a report.
      </p>

      <section aria-labelledby="sample-heading">
        <h2 id="sample-heading">Sample student</h2>
        <div className="picker" role="radiogroup" aria-label="Sample student">
          {views.map((item) => {
            const selected = item.student.id === view.student.id;
            return (
              <label key={item.student.id} className={selected ? "pick selected" : "pick"}>
                <input
                  type="radio"
                  name="sample-student"
                  value={item.student.id}
                  checked={selected}
                  onChange={() => setStudentId(item.student.id)}
                />
                <span className="pick-name">{item.student.label}</span>
                <span className="meta">
                  {item.majorName} · started {item.student.startYear}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="standing-heading">
        <h2 id="standing-heading">Courses on this sample</h2>
        <ul className="chips">
          {view.student.courses.map((course) => (
            <li key={`${course.code}-${course.term ?? "none"}`}>
              {course.code}
              <span className="meta">
                {" "}
                · {course.units} units · {course.status.replace("_", " ")}
                {course.grade ? ` · ${course.grade}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p>
          Stub audit of {view.majorName}: {view.audit.unitsApplied} units applied,{" "}
          {view.audit.unitsRemaining} units still showing on the stub
          {view.audit.satisfied ? ", and the stub marks the major satisfied" : ""}.{" "}
          {view.audit.coursesRemaining.length > 0
            ? `Course codes still listed: ${view.audit.coursesRemaining.join(", ")}.`
            : "No required course code is still listed."}
        </p>
      </section>

      <section aria-labelledby="addon-heading">
        <h2 id="addon-heading">Add-ons, from the stub</h2>
        {view.addOns.length === 0 ? (
          <p className="banner" role="status">
            The stub has no add-on for this sample.
          </p>
        ) : (
          <div className="stack">
            {view.addOns.map((item) => (
              <OpportunityCard key={item.programId} item={item} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="switch-heading">
        <h2 id="switch-heading">Switches, from the stub</h2>
        {view.switches.length === 0 ? (
          <p className="banner" role="status">
            The stub has no switch for this sample.
          </p>
        ) : (
          <div className="stack">
            {view.switches.map((item) => (
              <OpportunityCard key={item.programId} item={item} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="plan-heading">
        <h2 id="plan-heading">Term plan, from the stub</h2>
        {view.plan.terms.length === 0 ? (
          <p className="banner" role="status">
            The stub plan has no further terms for this major.
          </p>
        ) : (
          <ol className="plan">
            {view.plan.terms.map((term) => (
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
        <p className="meta">{view.plan.totalUnits} units on this stub plan.</p>
      </section>

      <footer className="colophon">
        <p>
          <SchemeWord /> is a skeleton. Rankings come from the engine stub, not a degree audit.
          Sample students are invented. Nothing is saved in this browser.
        </p>
      </footer>
    </main>
  );
}
