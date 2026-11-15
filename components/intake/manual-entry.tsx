"use client";

import { useMemo, useState } from "react";
import { listedPrograms, searchCatalogue } from "@/lib/stars";
import { createStudentRecord } from "@/lib/stars/record";
import type { Course, StudentCourse, StudentCourseStatus, StudentRecord } from "@/lib/types";

const majors = listedPrograms.filter((program) => program.kind === "major");
const minors = listedPrograms.filter((program) => program.kind === "minor");

export interface ManualCourseEntryProps {
  onRecord: (record: StudentRecord) => void;
}

export function ManualCourseEntry({ onRecord }: ManualCourseEntryProps) {
  const [query, setQuery] = useState("");
  const [majorId, setMajorId] = useState(majors[0]?.id ?? "");
  const [minorIds, setMinorIds] = useState<string[]>([]);
  const [startYear, setStartYear] = useState(2025);
  const [startSeason, setStartSeason] = useState<"fall" | "spring" | "summer">("fall");
  const [catalogueYear, setCatalogueYear] = useState("2026-2027");
  const [picked, setPicked] = useState<StudentCourse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => searchCatalogue(query), [query]);

  function addCourse(course: Course) {
    setPicked((current) => [
      ...current,
      {
        code: course.code,
        units: course.units,
        grade: "A",
        term: `${startYear}-${startSeason}`,
        status: "completed",
      },
    ]);
    setQuery("");
  }

  function updateCourse(index: number, patch: Partial<StudentCourse>) {
    setPicked((current) => current.map((course, courseIndex) => (courseIndex === index ? { ...course, ...patch } : course)));
  }

  function submit() {
    const major = majors.find((program) => program.id === majorId);
    if (!major) {
      setError("Choose a major.");
      return;
    }
    if (picked.length === 0) {
      setError("Add at least one course.");
      return;
    }
    const coursesForRecord = picked.map((course) =>
      course.status === "in_progress" ? { ...course, grade: null } : course,
    );
    try {
      onRecord(
        createStudentRecord({
          id: "manual-local",
          label: "Student",
          school: major.school,
          startYear,
          startTerm: `${startYear}-${startSeason}`,
          catalogueYear,
          majorId: major.id,
          declaredProgramIds: [major.id, ...minorIds.filter((id) => id !== major.id)],
          courses: coursesForRecord,
        }),
      );
      setError(null);
    } catch {
      setError("Those courses could not be saved. Check the grade and the term.");
    }
  }

  return (
    <section className="card" aria-labelledby="manual-entry-title">
      <header className="card-head">
        <h2 id="manual-entry-title">Enter courses</h2>
        <p className="meta">Search the catalogue. This builds the same record as a report.</p>
      </header>
      <label htmlFor="manual-major">
        Major
        <select id="manual-major" value={majorId} onChange={(event) => setMajorId(event.target.value)}>
          {majors.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Minors</legend>
        {minors.map((program) => (
          <label key={program.id}>
            <input
              type="checkbox"
              checked={minorIds.includes(program.id)}
              onChange={(event) => {
                setMinorIds((current) =>
                  event.target.checked ? [...current, program.id] : current.filter((id) => id !== program.id),
                );
              }}
            />
            {program.name}
          </label>
        ))}
      </fieldset>
      <label htmlFor="manual-year">
        Start year
        <input
          id="manual-year"
          type="number"
          min={1900}
          max={2100}
          value={startYear}
          onChange={(event) => setStartYear(Number(event.target.value))}
        />
      </label>
      <label htmlFor="manual-season">
        Start term
        <select
          id="manual-season"
          value={startSeason}
          onChange={(event) => setStartSeason(event.target.value as "fall" | "spring" | "summer")}
        >
          <option value="fall">Fall</option>
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
        </select>
      </label>
      <label htmlFor="manual-catalogue">
        Catalogue year
        <input id="manual-catalogue" value={catalogueYear} onChange={(event) => setCatalogueYear(event.target.value)} />
      </label>
      <label htmlFor="manual-search">
        Find a course
        <input
          id="manual-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Code or title"
        />
      </label>
      {matches.length > 0 ? (
        <ul>
          {matches.map((course) => (
            <li key={course.code}>
              <button type="button" onClick={() => addCourse(course)}>
                Add {course.code} ({course.units} units)
              </button>
              <span className="meta"> {course.title}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {picked.length > 0 ? (
        <ul>
          {picked.map((course, index) => (
            <li key={`${course.code}-${index}`}>
              {course.code}
              <label>
                Status
                <select
                  value={course.status}
                  onChange={(event) => {
                    const status = event.target.value as StudentCourseStatus;
                    updateCourse(index, { status, grade: status === "in_progress" ? null : course.grade ?? "A" });
                  }}
                >
                  <option value="completed">Completed</option>
                  <option value="in_progress">In progress</option>
                  <option value="transfer">Transfer</option>
                  <option value="ap">AP</option>
                </select>
              </label>
              <label>
                Term
                <input
                  value={course.term ?? ""}
                  onChange={(event) => updateCourse(index, { term: event.target.value })}
                />
              </label>
              {course.status === "in_progress" ? null : (
                <label>
                  Grade
                  <input
                    value={course.grade ?? ""}
                    onChange={(event) => updateCourse(index, { grade: event.target.value })}
                  />
                </label>
              )}
              <button type="button" onClick={() => setPicked((current) => current.filter((_, item) => item !== index))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={submit}>
        Use these courses
      </button>
    </section>
  );
}
