"use client";

import { useEffect, useRef, useState } from "react";
import { parseStarsText, StarsParseError } from "@/lib/stars/parse";
import type { StudentRecord } from "@/lib/types";

export function StarsPaste({ onRecord }: { onRecord: (record: StudentRecord) => void }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function readPaste() {
    const text = draft;
    if (!text.trim()) {
      setError("Paste a STARS report first.");
      return;
    }
    setError(null);
    setBusy(true);
    window.setTimeout(() => {
      try {
        const parsed = parseStarsText(text);
        if (!alive.current) return;
        setDraft("");
        setBusy(false);
        onRecord(parsed.record);
      } catch (caught) {
        if (!alive.current) return;
        const message = caught instanceof StarsParseError ? caught.message : "This report could not be read. Enter courses by hand.";
        setError(message);
        setBusy(false);
      }
    }, 0);
  }

  return (
    <section className="card" aria-labelledby="stars-paste-title">
      <header className="card-head">
        <h2 id="stars-paste-title">Paste the report</h2>
        <p>The text is read on this page and then cleared.</p>
      </header>
      <label htmlFor="stars-paste">
        STARS report text
        <textarea
          id="stars-paste"
          value={draft}
          rows={8}
          spellCheck={false}
          autoComplete="off"
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <button type="button" onClick={readPaste} disabled={busy}>
        {busy ? "Reading the pasted report…" : "Read pasted report"}
      </button>
      {busy ? <p role="status">Reading the pasted report…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
