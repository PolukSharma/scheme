"use client";

import { useEffect, useState } from "react";
import { careerRequestBody, chatRequestBody } from "@/components/rank-student";
import { z } from "zod";
import { careerMatchSchema, chatAnswerSchema, type CareerMatch, type ChatAnswer, type Opportunity, type OpportunityMode, type Program, type StudentRecord } from "@/lib/types";

interface CopiedDifficulty {
  programId: string;
  mode: OpportunityMode;
  extraTerms: number;
  extraUnits: number;
}

const SUGGESTED = [
  "Which requirements are still open?",
  "What does the plan assume?",
  "Which courses are in progress?",
  "can I add a data science minor without a fourth year?",
];

type RouteState = "checking" | "up" | "down";

async function probe(path: string): Promise<RouteState> {
  try {
    const response = await fetch(path, { method: "GET" });
    if (response.status === 404) return "down";
    return "up";
  } catch {
    return "down";
  }
}

export function CareerChat({
  student,
  programs,
  addOns,
  switches,
}: {
  student: StudentRecord;
  programs: readonly Program[];
  addOns: readonly Opportunity[];
  switches: readonly Opportunity[];
}) {
  const [careerRoute, setCareerRoute] = useState<RouteState>("checking");
  const [chatRoute, setChatRoute] = useState<RouteState>("checking");
  const [goal, setGoal] = useState("");
  const [matches, setMatches] = useState<CareerMatch[] | null>(null);
  const [difficulty, setDifficulty] = useState<CopiedDifficulty[]>([]);
  const [careerNote, setCareerNote] = useState<string | null>(null);
  const [careerBusy, setCareerBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [chatNote, setChatNote] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void probe("/api/career").then((state) => {
      if (!cancelled) setCareerRoute(state);
    });
    void probe("/api/chat").then((state) => {
      if (!cancelled) setChatRoute(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function askCareer() {
    const trimmed = goal.trim();
    if (!trimmed) {
      setCareerNote("Type a career goal first.");
      setMatches(null);
      setDifficulty([]);
      return;
    }
    setCareerBusy(true);
    setCareerNote(null);
    setMatches(null);
    setDifficulty([]);
    try {
      const response = await fetch("/api/career", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(careerRequestBody(trimmed, [...addOns, ...switches])),
      });
      if (!response.ok) {
        setCareerNote("Career matching did not answer. Extra terms and extra units stay with the engine on this page.");
        return;
      }
      const payload: unknown = await response.json();
      const envelope =
        payload && typeof payload === "object" && "matches" in payload
          ? z
              .object({
                matches: z.array(careerMatchSchema),
                fallback: z.boolean().optional(),
                note: z.string().optional(),
                difficulty: z
                  .array(
                    z.object({
                      programId: z.string(),
                      mode: z.enum(["add_on", "switch"]),
                      extraTerms: z.number(),
                      extraUnits: z.number(),
                    }),
                  )
                  .optional(),
              })
              .safeParse(payload)
          : null;
      const listed = Array.isArray(payload) ? careerMatchSchema.array().safeParse(payload) : null;
      const parsed = envelope?.success
        ? envelope.data
        : listed?.success
          ? { matches: listed.data, fallback: false, note: undefined, difficulty: undefined }
          : null;
      if (!parsed) {
        setCareerNote("Career matching did not return a suggestion the page could show. Extra terms and extra units stay with the engine on this page.");
        return;
      }
      setMatches(parsed.matches);
      setDifficulty(parsed.difficulty ?? []);
      if (parsed.fallback) {
        setCareerNote(parsed.note ?? "No career suggestion was made. Extra terms and extra units stay with the engine on this page.");
      } else if (parsed.matches.length === 0) {
        setCareerNote(parsed.note ?? "No strong match.");
      }
    } catch {
      setCareerRoute("down");
    } finally {
      setCareerBusy(false);
    }
  }

  async function askChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setChatNote("Type a question first.");
      setAnswer(null);
      return;
    }
    setQuestion(trimmed);
    setChatBusy(true);
    setChatNote(null);
    setAnswer(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(chatRequestBody(student, trimmed)),
      });
      if (!response.ok) {
        setChatNote("Chat did not answer. The plan on this page is from the engine.");
        return;
      }
      const payload: unknown = await response.json();
      const body = payload && typeof payload === "object" && "answer" in payload ? payload.answer : payload;
      const parsed = chatAnswerSchema.safeParse(body);
      if (!parsed.success) {
        setChatNote("The chat did not return an answer the page could show. The plan on this screen is from the engine.");
        return;
      }
      setAnswer(parsed.data);
    } catch {
      setChatRoute("down");
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="card" aria-labelledby="career-heading">
        <h3 id="career-heading">Career goal</h3>
        <p className="meta">A match is a suggestion. Extra terms and extra units are copied from the engine.</p>
        {careerRoute === "checking" ? <p role="status">Checking whether career matching is available.</p> : null}
        {careerRoute === "down" ? (
          <p className="banner" role="status">
            Career matching is unavailable. Nothing below is a career suggestion. Extra terms and extra units stay in engine order.
          </p>
        ) : null}
        {careerRoute === "up" ? (
          <>
            <label htmlFor="career-goal">
              Goal
              <input id="career-goal" value={goal} onChange={(event) => setGoal(event.target.value)} />
            </label>
            <button type="button" onClick={() => void askCareer()} disabled={careerBusy}>
              {careerBusy ? "Asking…" : "See suggestions"}
            </button>
            {careerNote ? <p role="status">{careerNote}</p> : null}
            {matches && matches.length > 0 ? (
              <ul className="stack">
                {matches.map((match) => {
                  const program = programs.find((item) => item.id === match.programId);
                  const copied = difficulty.find((item) => item.programId === match.programId);
                  const ranked = [...addOns, ...switches].find((item) => item.programId === match.programId && (!copied || item.mode === copied.mode));
                  const extraTerms = copied?.extraTerms ?? ranked?.extraTerms;
                  const extraUnits = copied?.extraUnits ?? ranked?.extraUnits;
                  return (
                    <li className="card" key={match.programId}>
                      <p>Suggestion · {program?.name ?? match.programId}</p>
                      <p>{match.reason}</p>
                      <p>
                        <a href={match.source.url}>Catalogue passage, {match.source.catalogueYear}</a>
                      </p>
                      {extraTerms !== undefined && extraUnits !== undefined ? (
                        <p className="meta">
                          Engine: {extraTerms} extra terms, {extraUnits} extra units.
                        </p>
                      ) : (
                        <p className="meta">The engine did not rank this program.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>
      <section className="card" aria-labelledby="chat-heading">
        <h3 id="chat-heading">Questions about the plan</h3>
        {chatRoute === "checking" ? <p role="status">Checking whether chat is available.</p> : null}
        {chatRoute === "down" ? (
          <p className="banner" role="status">
            Chat is unavailable. The plan on this page is from the engine. STARS remains the official audit.
          </p>
        ) : null}
        {chatRoute === "up" ? (
          <>
            <label htmlFor="plan-question">
              Question
              <input
                id="plan-question"
                value={question}
                placeholder="can I add a data science minor without a fourth year?"
                onChange={(event) => setQuestion(event.target.value)}
              />
            </label>
            <ul className="chips">
              {SUGGESTED.map((item) => (
                <li key={item}>
                  <button type="button" onClick={() => void askChat(item)}>
                    {item}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => void askChat(question)} disabled={chatBusy}>
              {chatBusy ? "Asking…" : "Ask"}
            </button>
            {chatNote ? <p role="status">{chatNote}</p> : null}
            {answer ? (
              <div>
                <p>{answer.text}</p>
                {answer.fallback ? <p className="meta">Engine-only answer.</p> : null}
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
        {chatRoute === "down" ? (
          <ul className="chips">
            {SUGGESTED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
