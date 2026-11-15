"use client";

import { useState } from "react";
import { parseStarsFile } from "@/lib/stars/pdf";
import { StarsParseError } from "@/lib/stars/parse";
import type { StudentRecord } from "@/lib/types";

export interface StarsDropZoneProps {
  onRecord: (record: StudentRecord) => void;
  onManualEntry?: () => void;
}

export function StarsDropZone({ onRecord, onManualEntry }: StarsDropZoneProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function readFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const parsed = await parseStarsFile(bytes, { mimeType: file.type, fileName: file.name });
      onRecord(parsed.record);
    } catch (caught) {
      const message = caught instanceof StarsParseError ? caught.message : "This report could not be read. Enter courses by hand.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="stars-drop-title" data-stars-drop="">
      <header className="card-head">
        <h2 id="stars-drop-title">STARS report</h2>
        <p>Parsed in your browser. Your report is never uploaded.</p>
      </header>
      <label htmlFor="stars-file">
        Choose a PDF or a saved HTML report
        <input
          id="stars-file"
          type="file"
          accept=".pdf,.html,.htm,.txt,application/pdf,text/html,text/plain"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
      </label>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) void readFile(file);
        }}
      >
        Or drop the report here. It stays on this device.
      </div>
      {busy ? <p className="meta">Reading the report…</p> : null}
      {error ? (
        <p role="alert">
          {error}{" "}
          {onManualEntry ? (
            <button type="button" onClick={onManualEntry}>
              Enter courses by hand
            </button>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
