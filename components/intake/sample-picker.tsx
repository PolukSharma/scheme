"use client";

import { sampleStudents } from "@/data/samples";
import type { StudentRecord } from "@/lib/types";

export interface SampleStudentPickerProps {
  onRecord: (record: StudentRecord) => void;
}

export function SampleStudentPicker({ onRecord }: SampleStudentPickerProps) {
  return (
    <section className="card" aria-labelledby="sample-picker-title">
      <header className="card-head">
        <h2 id="sample-picker-title">Sample students</h2>
        <p className="meta">Invented records. No report is loaded.</p>
      </header>
      <ul>
        {sampleStudents.map((student) => (
          <li key={student.id}>
            <button type="button" onClick={() => onRecord(student)}>
              {student.label}
            </button>
            <span className="meta"> {student.school}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
