import * as cheerio from "cheerio";

/**
 * The catalogue lists programs on two pages: a flat alphabetical list (navoid 9396) and a
 * list grouped by school (navoid 9453). The school page tells us which school owns a program.
 */

export const CATOID_2026_2027 = 22;
export const PROGRAMS_NAVOID = 9396;
export const PROGRAMS_BY_SCHOOL_NAVOID = 9453;

export interface CatalogueProgramEntry {
  poid: string;
  name: string;
  school: string | null;
  kind: "major" | "minor" | "other";
  degree: string | null;
}

function clean(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function contentUrl(navoid: number, catoid = CATOID_2026_2027): string {
  return `https://catalogue.usc.edu/content.php?catoid=${catoid}&navoid=${navoid}`;
}

export function programUrl(poid: string | number, catoid = CATOID_2026_2027): string {
  return `https://catalogue.usc.edu/preview_program.php?catoid=${catoid}&poid=${poid}`;
}

export function courseUrl(coid: string | number, catoid = CATOID_2026_2027): string {
  return `https://catalogue.usc.edu/preview_course_nopop.php?catoid=${catoid}&coid=${coid}`;
}

export function classify(name: string): Pick<CatalogueProgramEntry, "kind" | "degree"> {
  if (name.endsWith(" Minor")) return { kind: "minor", degree: null };
  const degree = /\((B[A-Za-z]*)\)$/.exec(name)?.[1] ?? null;
  if (degree) return { kind: "major", degree };
  return { kind: "other", degree: null };
}

export function parseProgramIndex(flatHtml: string, bySchoolHtml: string): CatalogueProgramEntry[] {
  const schoolOf = new Map<string, string>();
  const $school = cheerio.load(bySchoolHtml);
  let currentSchool = "";
  $school("h2, a[href*='preview_program']").each((_, el) => {
    if (el.type !== "tag") return;
    if (el.tagName.toLowerCase() === "h2") {
      currentSchool = clean($school(el).text());
      return;
    }
    const poid = /poid=(\d+)/.exec($school(el).attr("href") ?? "")?.[1];
    if (poid && currentSchool && !schoolOf.has(poid)) schoolOf.set(poid, currentSchool);
  });

  const entries: CatalogueProgramEntry[] = [];
  const seen = new Set<string>();
  const $flat = cheerio.load(flatHtml);
  $flat("a[href*='preview_program']").each((_, el) => {
    const poid = /poid=(\d+)/.exec($flat(el).attr("href") ?? "")?.[1];
    const name = clean($flat(el).text());
    if (!poid || !name || seen.has(poid)) return;
    seen.add(poid);
    entries.push({ poid, name, school: schoolOf.get(poid) ?? null, ...classify(name) });
  });
  return entries;
}
