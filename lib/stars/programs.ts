import indexJson from "@/data/programs/index.json";

export interface ListedProgram {
  id: string;
  name: string;
  school: string;
  kind: "major" | "minor" | "specialization";
}

const index = indexJson as { programs: ListedProgram[] };

export const listedPrograms: readonly ListedProgram[] = index.programs;

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(minor|major|bachelor|bs|ba)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchProgram(name: string, kind?: ListedProgram["kind"]): ListedProgram | null {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  const matches = listedPrograms.filter((program) => {
    if (kind && program.kind !== kind) return false;
    return normalizeName(program.name) === wanted;
  });
  if (matches.length === 1) return matches[0];
  return null;
}
