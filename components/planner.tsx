"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Catalogue } from "@/app/catalogue";
import { CareerChat } from "@/components/career-chat";
import { AdvisorSheet } from "@/components/advisor-sheet";
import { ProgramDetail } from "@/components/program-detail";
import {
  narrowResults,
  planChoice,
  rankStudent,
  schoolOptions,
  uniqueAssumptions,
  type ResultFilters,
  type StudentRanking,
} from "@/components/rank-student";
import { ResultList } from "@/components/result-list";
import { ScreenHeader } from "@/components/screen-header";
import { StarsPaste } from "@/components/stars-paste";
import type { Opportunity, Program, ProgramKind, StudentRecord } from "@/lib/types";

const IntakePanel = dynamic(() => import("@/components/intake").then((mod) => mod.IntakePanel), {
  ssr: false,
  loading: () => <p role="status">Loading course entry…</p>,
});

type Screen = "home" | "intake" | "results" | "detail" | "print";
type Lens = "add" | "switch" | "career";

interface OpenedProgram {
  program: Program;
  opportunity: Opportunity;
  audit: ReturnType<typeof planChoice>["audit"];
  plan: ReturnType<typeof planChoice>["plan"];
}

export function Planner({ catalogue }: { catalogue: Catalogue }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [ranking, setRanking] = useState<StudentRanking | null>(null);
  const [rankError, setRankError] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>("add");
  const [kind, setKind] = useState<ResultFilters["kind"]>("all");
  const [school, setSchool] = useState("all");
  const [verification, setVerification] = useState<ResultFilters["verification"]>("all");
  const [opened, setOpened] = useState<OpenedProgram | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [advisorName, setAdvisorName] = useState("");
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.setAttribute("data-ready", "true");
  }, []);

  const openedScreen = useRef(false);
  useEffect(() => {
    if (!openedScreen.current) {
      openedScreen.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [screen]);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      try {
        const next = rankStudent(
          student,
          catalogue.programs,
          catalogue.courses,
          catalogue.policyRules,
          catalogue.transferRules,
        );
        if (!cancelled) {
          setRanking(next);
          setRankError(null);
        }
      } catch {
        if (!cancelled) {
          setRanking(null);
          setRankError("This major is not in the program list. Choose another major or a sample student.");
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [student, catalogue]);

  function accept(record: StudentRecord) {
    setStudent(record);
    setRanking(null);
    setRankError(null);
    setOpened(null);
    setLens("add");
    setKind("all");
    setSchool("all");
    setVerification("all");
    setScreen("results");
  }

  function openProgram(item: Opportunity) {
    if (!student) return;
    const program = catalogue.programs.find((entry) => entry.id === item.programId);
    setScreen("detail");
    setOpened(null);
    setDetailError(null);
    if (!program) {
      setDetailError("This program is not in the program list.");
      return;
    }
    window.setTimeout(() => {
      try {
        const planned = planChoice(
          student,
          item.mode,
          program,
          catalogue.programs,
          catalogue.courses,
          catalogue.policyRules,
        );
        setOpened({ program, opportunity: item, audit: planned.audit, plan: planned.plan });
      } catch {
        setDetailError("This program could not be opened.");
      }
    }, 0);
  }

  const major = student ? catalogue.programs.find((program) => program.id === student.majorId) : undefined;
  const title =
    screen === "intake"
      ? "intake"
      : screen === "results"
        ? "results"
        : screen === "detail"
          ? "detail"
          : screen === "print"
            ? "advisor copy"
            : undefined;

  return (
    <main className="wrap" id="content" ref={mainRef} data-ready="false">
      {screen === "print" ? null : <ScreenHeader title={title} headingRef={headingRef} />}
      {screen === "home" ? (
        <>
          <p className="lede">
            A planning aid for USC students. Add a STARS report, paste one, enter courses, or try a sample student. Rankings come from the engine.
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => setSamplesOpen(true)}>
              Try a sample student
            </button>
            {samplesOpen ? (
              catalogue.samples.length === 0 ? (
                <p className="banner" role="status">
                  No sample student is available.
                </p>
              ) : (
                <div className="picker" role="group" aria-label="Sample students">
                  {catalogue.samples.map((sample) => (
                    <button type="button" key={sample.id} onClick={() => accept(sample)}>
                      <span className="pick-name">{sample.label}</span>
                      <span className="meta"> started {sample.startYear}</span>
                    </button>
                  ))}
                </div>
              )
            ) : null}
            <button type="button" onClick={() => setScreen("intake")}>
              Add my courses
            </button>
          </div>
        </>
      ) : null}

      {screen === "intake" ? (
        <>
          <p className="lede">
            Major, start year, and courses. A report fills the major and the start term. Enter courses asks for both. A sample student brings its own.
          </p>
          <p className="privacy">Parsed in your browser session, nothing stored.</p>
          <StarsPaste onRecord={accept} />
          <IntakePanel onRecord={accept} />
          <p>
            <button type="button" onClick={() => setScreen("home")}>
              Back
            </button>
          </p>
        </>
      ) : null}

      {screen === "results" && student ? (
        <>
          <p>
            {major?.name ?? "Major not in the program list"} · started {student.startTerm} · {student.courses.length} courses on this record
          </p>
          {rankError ? (
            <p className="banner" role="alert">
              {rankError}
            </p>
          ) : null}
          {!ranking && !rankError ? <p role="status">Ranking programs.</p> : null}
          {ranking ? (
            <>
              <div role="tablist" aria-label="How to look at programs">
                <button type="button" role="tab" id="lens-add" aria-selected={lens === "add"} onClick={() => setLens("add")}>
                  Easiest to add
                </button>
                <button type="button" role="tab" id="lens-switch" aria-selected={lens === "switch"} onClick={() => setLens("switch")}>
                  Easiest to switch into
                </button>
                <button type="button" role="tab" id="lens-career" aria-selected={lens === "career"} onClick={() => setLens("career")}>
                  Best for my career goal
                </button>
              </div>
              <div className="filters">
                <label htmlFor="kind-filter">
                  Program type
                  <select
                    id="kind-filter"
                    value={kind}
                    onChange={(event) => setKind(event.target.value as "all" | ProgramKind)}
                  >
                    <option value="all">All types</option>
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                    <option value="specialization">Specialization</option>
                  </select>
                </label>
                <label htmlFor="school-filter">
                  School
                  <select id="school-filter" value={school} onChange={(event) => setSchool(event.target.value)}>
                    <option value="all">All schools</option>
                    {schoolOptions(catalogue.programs).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="status-filter">
                  Catalogue check
                  <select
                    id="status-filter"
                    value={verification}
                    onChange={(event) => setVerification(event.target.value as ResultFilters["verification"])}
                  >
                    <option value="all">All statuses</option>
                    <option value="verified">Verified only</option>
                    <option value="unverified">Not verified</option>
                  </select>
                </label>
              </div>
              {lens === "switch" ? (
                <p className="meta">A negative number is fewer terms or units than the current major.</p>
              ) : null}
              <div role="tabpanel" aria-labelledby={lens === "add" ? "lens-add" : lens === "switch" ? "lens-switch" : "lens-career"}>
                {lens === "career" ? (
                  <>
                    <CareerChat
                      student={student}
                      programs={catalogue.programs}
                      addOns={ranking.addOns}
                      switches={ranking.switches}
                    />
                    <h2>Engine order, not a career ranking</h2>
                  </>
                ) : null}
                <ResultList
                  rows={narrowResults(lens === "switch" ? ranking.switches : ranking.addOns, catalogue.programs, {
                    kind,
                    school,
                    verification,
                  })}
                  programs={catalogue.programs}
                  policyRules={catalogue.policyRules}
                  modeLabel={lens === "switch" ? "switch" : "add-on"}
                  onOpen={openProgram}
                />
              </div>
              <Assumptions ranking={ranking} />
            </>
          ) : null}
          <p>
            <button
              type="button"
              onClick={() => {
                setStudent(null);
                setRanking(null);
                setScreen("home");
              }}
            >
              Start over
            </button>
          </p>
        </>
      ) : null}

      {screen === "detail" ? (
        detailError ? (
          <p className="banner" role="alert">
            {detailError}{" "}
            <button type="button" onClick={() => setScreen("results")}>
              Back to results
            </button>
          </p>
        ) : !opened || !student ? (
          <p role="status">Opening this program.</p>
        ) : (
          <ProgramDetail
            program={opened.program}
            opportunity={opened.opportunity}
            audit={opened.audit}
            plan={opened.plan}
            courses={catalogue.courses}
            student={student}
            policyRules={catalogue.policyRules}
            onBack={() => setScreen("results")}
            onPdf={() => setScreen("print")}
          />
        )
      ) : null}

      {screen === "print" && student && major && opened ? (
        <>
          <div className="no-print stack">
            <p>
              <label htmlFor="advisor-name">
                Name on the advisor copy
                <input
                  id="advisor-name"
                  value={advisorName}
                  onChange={(event) => setAdvisorName(event.target.value)}
                  autoComplete="name"
                />
              </label>
            </p>
            <p className="meta">Leave this blank and the copy has no name. It is not saved or uploaded.</p>
            <p>
              <button type="button" className="primary" onClick={() => window.print()}>
                Save as PDF
              </button>
              <button type="button" onClick={() => setScreen("detail")}>
                Back
              </button>
            </p>
          </div>
          <AdvisorSheet
            student={student}
            major={major}
            program={opened.program}
            opportunity={opened.opportunity}
            audit={opened.audit}
            plan={opened.plan}
            courses={catalogue.courses}
            policyRules={catalogue.policyRules}
            name={advisorName}
            headingRef={headingRef}
          />
        </>
      ) : null}
      {screen === "print" && (!student || !major || !opened) ? (
        <p className="banner" role="status">
          Open a program before making an advisor copy.
        </p>
      ) : null}
    </main>
  );
}

function Assumptions({ ranking }: { ranking: StudentRanking }) {
  const assumptions = uniqueAssumptions([ranking.declaredAudit, ranking.declaredPlan, ...ranking.addOns, ...ranking.switches]);
  if (assumptions.length === 0) return null;
  return (
    <section aria-labelledby="result-assumptions">
      <h2 id="result-assumptions">Assumptions</h2>
      <ul>
        {assumptions.map((assumption) => (
          <li key={`${assumption.ruleId}-${assumption.text}`}>{assumption.text}</li>
        ))}
      </ul>
    </section>
  );
}
