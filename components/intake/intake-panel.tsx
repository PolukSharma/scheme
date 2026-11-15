"use client";

import { useState } from "react";
import type { StudentRecord } from "@/lib/types";
import { ManualCourseEntry } from "./manual-entry";
import { SampleStudentPicker } from "./sample-picker";
import { StarsDropZone } from "./drop-zone";

export interface IntakePanelProps {
  onRecord: (record: StudentRecord) => void;
}

type IntakeMode = "report" | "manual" | "sample";

export function IntakePanel({ onRecord }: IntakePanelProps) {
  const [mode, setMode] = useState<IntakeMode>("report");

  return (
    <div>
      <div role="tablist" aria-label="How to add courses">
        <button type="button" role="tab" aria-selected={mode === "report"} onClick={() => setMode("report")}>
          STARS report
        </button>
        <button type="button" role="tab" aria-selected={mode === "manual"} onClick={() => setMode("manual")}>
          Enter courses
        </button>
        <button type="button" role="tab" aria-selected={mode === "sample"} onClick={() => setMode("sample")}>
          Sample student
        </button>
      </div>
      {mode === "report" ? <StarsDropZone onRecord={onRecord} onManualEntry={() => setMode("manual")} /> : null}
      {mode === "manual" ? <ManualCourseEntry onRecord={onRecord} /> : null}
      {mode === "sample" ? <SampleStudentPicker onRecord={onRecord} /> : null}
    </div>
  );
}
