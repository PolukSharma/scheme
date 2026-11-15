import { z } from "zod";
import type { ModelFn } from "@/lib/ai/client";
import { guardOutput } from "@/lib/ai/guard";
import { isOutsideQuestion, unknownCourseCode } from "@/lib/ai/policy";
import { recordUsage } from "@/lib/ai/usage";
import { audit, planTerms, rankAddOns, rankSwitches } from "@/lib/engine";
import {
  courseCodeSchema,
  studentRecordSchema,
  type AuditResult,
  type ChatAnswer,
  type Course,
  type Opportunity,
  type PolicyRule,
  type Program,
  type RequirementNode,
  type Source,
  type StudentRecord,
  type TermPlan,
  type TransferRule,
} from "@/lib/types";

const requestSchema = z
  .object({
    courses: z
      .array(
        z
          .object({
            code: courseCodeSchema,
            status: z.enum(["completed", "in_progress"]),
          })
          .strict(),
      )
      .max(80),
    programIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(12),
    startTerm: z.string().min(4).max(40),
    question: z.string().trim().min(1).max(500),
  })
  .strict();

export interface ChatCatalogue {
  programs: readonly Program[];
  courses: readonly Course[];
  policyRules: readonly PolicyRule[];
  transferRules: readonly TransferRule[];
}

const refusalText =
  "That question is outside what this planner can answer. It does not estimate admission, grades needed to get in, salaries, job placement, or hiring. Ask an advisor or use the official catalogue page. STARS remains the official audit.";

const plainText =
  "This answer is from the engine, not a model. STARS remains the official audit. The requirement list on this page is the engine's list.";

function walk(node: RequirementNode, into: { programId: string; node: RequirementNode }[], programId: string): void {
  into.push({ programId, node });
  if (node.type === "all_of") node.children.forEach((child) => walk(child, into, programId));
  if (node.type === "n_of") node.options.forEach((child) => walk(child, into, programId));
}

function knownCodes(catalogue: ChatCatalogue): Set<string> {
  const codes = new Set(catalogue.courses.map((course) => course.code));
  for (const program of catalogue.programs) {
    const nodes: { programId: string; node: RequirementNode }[] = [];
    walk(program.requirements, nodes, program.id);
    for (const item of nodes) {
      if (item.node.type === "course") codes.add(item.node.code);
    }
  }
  return codes;
}

function sourcesFor(program: Program): Source[] {
  const nodes: { programId: string; node: RequirementNode }[] = [];
  walk(program.requirements, nodes, program.id);
  return [program.source, ...nodes.map((item) => item.node.source)];
}

function cited(program: Program | undefined): ChatAnswer {
  const source = program?.source;
  return {
    text: refusalText,
    citations: source ? [{ label: program.name, source }] : [],
    fallback: true,
  };
}

function yearFrom(startTerm: string, catalogueYear: string): number | null {
  const term = /^(\d{4})/.exec(startTerm);
  const catalogue = /^(\d{4})/.exec(catalogueYear);
  const year = Number(term?.[1] ?? catalogue?.[1]);
  return Number.isInteger(year) ? year : null;
}

function withoutIdentity<T extends { studentId?: string }>(value: T): Omit<T, "studentId"> {
  const rest = { ...value };
  delete rest.studentId;
  return rest;
}

interface Packet {
  corpus: string;
  allowed: Source[];
  audit: AuditResult;
  addOns: Opportunity[];
  switches: Opportunity[];
  plan: TermPlan;
  major: Program;
}

function runPacket(student: StudentRecord, catalogue: ChatCatalogue, major: Program, declared: Program[]): Packet | null {
  try {
    const others = catalogue.programs.filter((program) => !declared.some((item) => item.id === program.id));
    const majors = catalogue.programs.filter((program) => program.kind === "major" && program.id !== major.id);
    const auditResult = audit(student, major, catalogue.courses, catalogue.policyRules);
    const addOns = rankAddOns(student, declared, others, catalogue.courses, catalogue.policyRules, catalogue.transferRules);
    const switches = rankSwitches(student, major, majors, catalogue.courses, catalogue.policyRules, catalogue.transferRules);
    const plan = planTerms(student, declared, catalogue.courses, catalogue.policyRules);
    const allowed = declared.flatMap(sourcesFor);
    const packet = {
      audit: withoutIdentity(auditResult),
      rankAddOns: addOns.map(withoutIdentity),
      rankSwitches: switches.map(withoutIdentity),
      planTerms: withoutIdentity(plan),
      requirementSource: allowed.map((source) => ({ url: source.url, catalogueYear: source.catalogueYear, text: source.text })),
      transferRule: catalogue.transferRules.filter((rule) => catalogue.programs.some((program) => program.school === rule.school)),
    };
    return { corpus: JSON.stringify(packet), allowed, audit: auditResult, addOns, switches, plan, major };
  } catch {
    return null;
  }
}

function engineText(packet: Packet): string {
  const open = packet.audit.coursesRemaining;
  const lines = [plainText];
  lines.push(packet.audit.satisfied ? "The engine marks the current major satisfied." : "The engine marks the current major open.");
  if (open.length > 0) lines.push(`Courses the engine still lists: ${open.join(", ")}.`);
  const binding = packet.addOns[0]?.bindingConstraint;
  if (binding) lines.push(binding);
  for (const assumption of packet.audit.assumptions.slice(0, 2)) lines.push(assumption.text);
  return lines.join(" ");
}

function engineAnswer(packet: Packet, corpus: string): ChatAnswer {
  const citations = packet.allowed.slice(0, 3).map((source) => ({ label: packet.major.name, source }));
  const rich: ChatAnswer = { text: engineText(packet), citations, fallback: true };
  const guarded = guardOutput(rich.text, citations.map((item) => item.source), corpus, packet.allowed);
  if (guarded.ok) return rich;
  const plain: ChatAnswer = {
    text: plainText,
    citations: packet.major.source ? [{ label: packet.major.name, source: packet.major.source }] : [],
    fallback: true,
  };
  const plainGuard = guardOutput(
    plain.text,
    plain.citations.map((item) => item.source),
    corpus,
    packet.allowed,
  );
  return plainGuard.ok ? plain : { text: plainText, citations: [], fallback: true };
}

function programById(catalogue: ChatCatalogue, programId: string): Program | undefined {
  return catalogue.programs.find((program) => program.id === programId);
}

function citeProgram(program: Program): ChatAnswer["citations"][number] {
  return { label: program.name, source: program.source };
}

function namedProgram(question: string): { query: string; kind: "minor" | "major" | "specialization" | null } {
  const kindMatch = question.match(/\b(minor|major|specialization)\b/i);
  const kind = kindMatch ? (kindMatch[1].toLowerCase() as "minor" | "major" | "specialization") : null;
  const before = question.match(
    /\b(?:add|adding|declare|declaring|pursue|pursuing)\s+(?:a|an|the|my)?\s*([a-z0-9][a-z0-9\s]{0,80}?)\s+(?:minor|major|specialization)\b/i,
  );
  const query = (before?.[1] ?? "")
    .replace(/\b(a|an|the|my)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return { query, kind };
}

function programsNamed(query: string, programs: readonly Program[], kind: "minor" | "major" | "specialization" | null): Program[] {
  const words = query.split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  if (words.length === 0) return [];
  return programs.filter((program) => {
    if (kind && program.kind !== kind) return false;
    const name = program.name.toLowerCase();
    return words.every((word) => name.includes(word));
  });
}

function extraTermCap(question: string): number | undefined {
  if (
    /without (?:a |an )?(?:fourth year|extra year|extra term|extra semester)|no extra (?:year|term|semester)|without adding (?:a |an )?(?:year|term|semester|fourth year)/i.test(
      question,
    )
  ) {
    return 0;
  }
  return undefined;
}

function publish(text: string, citations: ChatAnswer["citations"], packet: Packet, corpus: string, names: readonly string[]): ChatAnswer {
  const allowed = [...packet.allowed, ...citations.map((item) => item.source)];
  const guarded = guardOutput(
    text,
    citations.map((item) => item.source),
    corpus,
    allowed,
    names,
  );
  if (guarded.ok) return { text, citations, fallback: true };
  return engineAnswer(packet, corpus);
}

function opportunityAnswer(question: string, packet: Packet, catalogue: ChatCatalogue, corpus: string): ChatAnswer {
  const switching = /\bswitch/i.test(question) && !/\b(?:add|adding|minor)\b/i.test(question);
  const { query, kind } = namedProgram(question);
  const cap = extraTermCap(question);
  const rows = switching ? packet.switches : packet.addOns;
  const wantedKind = switching ? "major" : kind;
  const pool = rows.filter((item) => {
    const program = programById(catalogue, item.programId);
    return program ? !wantedKind || program.kind === wantedKind : false;
  });
  const named = query ? programsNamed(query, catalogue.programs, wantedKind) : [];
  const names = catalogue.programs.map((program) => program.name);
  const labelsOf = (items: readonly Opportunity[]) =>
    items.flatMap((item) => {
      const program = programById(catalogue, item.programId);
      return program ? [program.name] : [];
    });
  const citationsOf = (items: readonly Opportunity[]) =>
    items.flatMap((item) => {
      const program = programById(catalogue, item.programId);
      return program ? [citeProgram(program)] : [];
    });

  if (query && named.length === 0) {
    const within = cap === 0 ? pool.filter((item) => item.extraTerms === 0) : [];
    const withinNames = labelsOf(within);
    const kindWord = wantedKind ?? "program";
    const limit = cap === 0 ? " The limit in the question is no extra terms." : "";
    const listed = withinNames.length
      ? ` The engine ranks these at zero extra terms: ${withinNames.join(", ")}.`
      : cap === 0
        ? " The engine ranks no program of that type at zero extra terms."
        : "";
    const text = `This answer is from the engine, not a model. The engine has no ${kindWord} named ${query} in this catalogue, so it has no result for adding that ${kindWord}.${limit}${listed} STARS remains the official audit.`;
    return publish(text, citationsOf(within), packet, [corpus, ...withinNames].join("\n"), names);
  }

  const selected = pool.filter((item) => named.length === 0 || named.some((program) => program.id === item.programId));
  const over = cap !== undefined && named.length > 0 ? selected.filter((item) => item.extraTerms > cap) : [];
  const shown = selected.filter((item) => cap === undefined || item.extraTerms <= cap);
  if (shown.length === 0 && over.length > 0) {
    const lines = over.map((item) => {
      const program = programById(catalogue, item.programId);
      return `The engine lists ${program?.name ?? item.programId} at ${item.extraTerms} extra terms and ${item.extraUnits} extra units, which is over the limit in the question. ${item.bindingConstraint}`;
    });
    const text = `This answer is from the engine, not a model. ${lines.join(" ")} STARS remains the official audit.`;
    return publish(text, citationsOf(over), packet, [corpus, ...labelsOf(over)].join("\n"), names);
  }
  const picked = shown.slice(0, 3);
  if (picked.length === 0) return engineAnswer(packet, corpus);
  const lines = picked.map((item) => {
    const program = programById(catalogue, item.programId);
    const limit = cap !== undefined && item.extraTerms <= cap ? " This meets the limit in the question." : "";
    return `The engine lists ${program?.name ?? item.programId} at ${item.extraTerms} extra terms and ${item.extraUnits} extra units.${limit} ${item.bindingConstraint}`;
  });
  const text = `This answer is from the engine, not a model. ${lines.join(" ")} STARS remains the official audit.`;
  return publish(text, citationsOf(picked), packet, [corpus, ...labelsOf(picked)].join("\n"), names);
}

function computedAnswer(
  question: string,
  courses: readonly { code: string; status: "completed" | "in_progress" }[],
  packet: Packet,
  catalogue: ChatCatalogue,
  corpus: string,
): ChatAnswer {
  const names = catalogue.programs.map((program) => program.name);
  if (/still open|requirements are|what remains|courses remaining/i.test(question)) return engineAnswer(packet, corpus);
  if (/\bassum/i.test(question)) {
    const lines = packet.audit.assumptions.map((assumption) => assumption.text);
    const text = lines.length ? `${plainText} ${lines.join(" ")}` : `${plainText} The engine returned no assumptions.`;
    const citations = catalogue.policyRules
      .filter((rule) => packet.audit.assumptions.some((assumption) => assumption.ruleId === rule.id))
      .map((rule) => ({ label: rule.name, source: rule.source }));
    return publish(text, citations, packet, corpus, names);
  }
  if (/in progress/i.test(question)) {
    const codes = courses.filter((course) => course.status === "in_progress").map((course) => course.code);
    const text = codes.length
      ? `${plainText} The engine treats these courses as in progress: ${codes.join(", ")}.`
      : `${plainText} The engine lists no in-progress courses.`;
    const citations = codes.flatMap((code) => {
      const course = catalogue.courses.find((item) => item.code === code);
      return course ? [{ label: course.code, source: course.source }] : [];
    });
    return publish(text, citations.length > 0 ? citations : [{ label: packet.major.name, source: packet.major.source }], packet, corpus, names);
  }
  if (/\b(?:add|adding|minor|major|specialization|can i|could i|switch)\b/i.test(question)) {
    return opportunityAnswer(question, packet, catalogue, corpus);
  }
  return engineAnswer(packet, corpus);
}

export async function answerChat(raw: unknown, catalogue: ChatCatalogue, _model: ModelFn | null): Promise<{ status: number; body: ChatAnswer | { error: string } }> {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, body: { error: "The body must be course codes, program ids, a start term, and a question, and nothing else." } };
  }
  const declared = parsed.data.programIds.flatMap((id) => {
    const program = catalogue.programs.find((item) => item.id === id);
    return program ? [program] : [];
  });
  const major = declared.find((program) => program.kind === "major") ?? declared[0];
  if (!major) return { status: 400, body: { error: "None of the program ids are in the catalogue." } };
  const known = knownCodes(catalogue);
  if (isOutsideQuestion(parsed.data.question) || unknownCourseCode(parsed.data.question, known)) {
    recordUsage("chat", 0, 0, 0);
    return { status: 200, body: cited(major) };
  }
  const byCode = new Map(catalogue.courses.map((course) => [course.code, course]));
  const rows = parsed.data.courses.flatMap((course) => {
    const found = byCode.get(course.code);
    return found ? [{ code: course.code, units: found.units, grade: null, term: parsed.data.startTerm, status: course.status }] : [];
  });
  if (rows.length !== parsed.data.courses.length) {
    recordUsage("chat", 0, 0, 0);
    return { status: 200, body: cited(major) };
  }
  const startYear = yearFrom(parsed.data.startTerm, major.catalogueYear);
  if (startYear === null) return { status: 400, body: { error: "The start term needs a year." } };
  let student: StudentRecord;
  try {
    student = studentRecordSchema.parse({
      id: "plan",
      label: "Plan",
      school: major.school,
      startYear,
      startTerm: parsed.data.startTerm,
      catalogueYear: major.catalogueYear,
      majorId: major.id,
      declaredProgramIds: declared.map((program) => program.id),
      courses: rows,
    });
  } catch {
    recordUsage("chat", 0, 0, 0);
    return { status: 200, body: cited(major) };
  }
  const packet = runPacket(student, catalogue, major, declared);
  if (!packet) {
    recordUsage("chat", 0, 0, 0);
    return { status: 200, body: cited(major) };
  }
  const corpus = [packet.corpus, parsed.data.question, parsed.data.startTerm, parsed.data.courses.map((course) => course.code).join(" ")].join("\n");
  void _model;
  recordUsage("chat", 0, 0, 0);
  return { status: 200, body: computedAnswer(parsed.data.question, parsed.data.courses, packet, catalogue, corpus) };
}

/** Tool names the model may be told about. The route always runs these itself. */
export const engineTools = ["audit", "rankAddOns", "rankSwitches", "planTerms", "requirementSource", "transferRule"] as const;
