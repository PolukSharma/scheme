import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CataloguePages } from "./fetch";
import {
  CATOID_2026_2027,
  PROGRAMS_BY_SCHOOL_NAVOID,
  PROGRAMS_NAVOID,
  contentUrl,
  parseProgramIndex,
  programUrl,
  type CatalogueProgramEntry,
} from "./index-page";
import { collectCourses, overlapAgainst, pageFor, type OverlapRow } from "./overlap";
import { parseProgramPage } from "./parse";

/**
 * Builds data/program-list.json (Program data, step 0).
 *
 *   npx tsx scripts/catalogue/program-list.ts [scanCacheDir]
 *
 * The scan cache holds every undergraduate program page. It is large, so it lives outside
 * the repository by default. The committed output keeps only the overlap numbers.
 */

const ROOT = path.resolve(__dirname, "../..");
const YEAR = "2026-2027";
const CHECKED_ON = "2026-11-14";

type Role = "current" | "switch_target" | "overlap_pick";

interface Request {
  requestedName: string;
  requestedType: "major" | "minor" | "specialization";
  combo: string | null;
  role: Role;
  /** Catalogue entry names that answer the request, in order of preference. */
  match: string[];
  /** Why the match is or is not exact. Written by a person after reading the catalogue. */
  note: string;
  status: "found" | "found_under_a_different_name" | "found_more_than_one" | "not_found_as_named";
  closest?: string[];
}

const REQUESTS: Request[] = [
  {
    requestedName: "Computer Science/Business Administration (CSBA)",
    requestedType: "major",
    combo: "1",
    role: "current",
    match: ["Computer Science/Business Administration (BS)"],
    note: "The catalogue title carries the degree, (BS), and not the abbreviation. The page itself says CSBA.",
    status: "found",
  },
  {
    requestedName: "Law and Regulation of AI",
    requestedType: "minor",
    combo: "1",
    role: "current",
    match: ["Law and Regulation of Artificial Intelligence Minor"],
    note: "The catalogue spells out Artificial Intelligence. The team's name is the same words abbreviated. A teammate should confirm this is the minor they mean.",
    status: "found_under_a_different_name",
  },
  {
    requestedName: "AI Applications (as a specialization of the CSBA major)",
    requestedType: "specialization",
    combo: "1",
    role: "current",
    match: [],
    note: "No specialization, track, or emphasis named AI Applications appears in the 2026-2027 program index, and neither the Computer Science/Business Administration (BS) page nor the Computer Science (BS) page mentions one. The only catalogue entry with this name is a minor. Not substituted. A human decides whether the team means that minor.",
    status: "not_found_as_named",
    closest: [
      "Artificial Intelligence Applications Minor",
      "Applied AI in Business Minor",
      "Artificial Intelligence Minor",
      "Artificial Intelligence for Business (BS)",
    ],
  },
  {
    requestedName: "Computational Neuroscience",
    requestedType: "major",
    combo: "2",
    role: "current",
    match: ["Computational Neuroscience (BS)"],
    note: "Exact title plus the degree, (BS). It is the only Computational Neuroscience entry in the index.",
    status: "found",
  },
  {
    requestedName: "AI Applications (as a minor)",
    requestedType: "minor",
    combo: "2",
    role: "current",
    match: ["Artificial Intelligence Applications Minor"],
    note: "The catalogue spells out Artificial Intelligence. The team's name is the same words abbreviated. A teammate should confirm.",
    status: "found_under_a_different_name",
  },
  {
    requestedName: "Neuroscience",
    requestedType: "major",
    combo: null,
    role: "switch_target",
    match: ["Neuroscience (BS)", "Neuroscience (BA)"],
    note: "Two majors carry this name, a BA and a BS, in the USC Dornsife College of Letters, Arts and Sciences. The BS is listed first only because Computational Neuroscience is also a BS. A human picks. The Neuroscience Minor is a third entry.",
    status: "found_more_than_one",
    closest: ["Neuroscience Minor"],
  },
  {
    requestedName: "Computer Science",
    requestedType: "major",
    combo: null,
    role: "switch_target",
    match: ["Computer Science (BS)"],
    note: "Exact title plus the degree, (BS). It is in the USC Viterbi School of Engineering. The catalogue also lists Computer Science Games (BS), Computer Engineering and Computer Science (BS), and a Computer Science Minor, which are different entries.",
    status: "found",
  },
];

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function byName(entries: CatalogueProgramEntry[], name: string): CatalogueProgramEntry | undefined {
  return entries.find((entry) => entry.name === name);
}

interface ListedProgram {
  id: string;
  role: Role;
  combo: string | null;
  requestedName: string | null;
  requestedType: "major" | "minor" | "specialization";
  status: Request["status"];
  catalogueName: string | null;
  school: string | null;
  kind: CatalogueProgramEntry["kind"] | null;
  degree: string | null;
  url: string | null;
  poid: string | null;
  catalogueYear: string;
  note: string;
  closestEntries: { name: string; url: string | null; school: string | null }[];
  overlap: {
    distinctCoursesShared: number;
    unitsShared: number;
    courses: string[];
    coursesListedByProgram: number;
  } | null;
  selected: boolean;
}

interface Pick {
  name: string;
  keep: boolean;
  reason: string;
}

/**
 * A person reads the ranked overlap table and records here which of the top rows are kept
 * and why any row above the sixth is skipped. The ranking itself is computed.
 */
const REVIEW: Pick[] = [];

async function main(): Promise<void> {
  const scanCache = process.argv[2] ?? "/tmp/usc/scan";
  const repoCache = path.join(ROOT, "data/raw", YEAR);
  mkdirSync(repoCache, { recursive: true });
  const pages = new CataloguePages({ cacheDir: repoCache, log: console.log });
  try {
    const flat = await pages.get(contentUrl(PROGRAMS_NAVOID));
    const bySchool = await pages.get(contentUrl(PROGRAMS_BY_SCHOOL_NAVOID));
    const entries = parseProgramIndex(flat, bySchool);
    console.log(`index: ${entries.length} entries`);

    const resolved = REQUESTS.map((request) => ({
      request,
      entries: request.match.map((name) => {
        const found = byName(entries, name);
        if (!found) throw new Error(`Catalogue has no entry named "${name}"`);
        return found;
      }),
    }));

    const namedPoids = new Set(resolved.flatMap((item) => item.entries.map((entry) => entry.poid)));
    for (const item of resolved) {
      for (const closest of item.request.closest ?? []) {
        const hit = byName(entries, closest);
        if (hit) namedPoids.add(hit.poid);
      }
    }

    const referencePoids = ["Computer Science/Business Administration (BS)", "Computational Neuroscience (BS)"].map(
      (name) => byName(entries, name)!.poid,
    );
    const reference = new Set<string>();
    for (const poid of referencePoids) {
      const html = await pages.get(programUrl(poid));
      collectCourses(parseProgramPage(html).outline).forEach((_, code) => reference.add(code));
    }
    console.log(`reference courses (both majors): ${reference.size}`);

    const candidates = entries
      .filter((entry) => entry.kind !== "other" && !namedPoids.has(entry.poid))
      .map((entry) => ({ poid: entry.poid, name: entry.name }));
    const rows = overlapAgainst(scanCache, candidates, reference);
    console.log(`overlap computed for ${rows.length} of ${candidates.length} candidates`);

    const schoolOf = new Map(entries.map((entry) => [entry.poid, entry.school]));
    writeFileSync(
      path.join(repoCache, "overlap-scan.json"),
      `${JSON.stringify(
        {
          catalogueYear: YEAR,
          checkedOn: CHECKED_ON,
          referencePrograms: referencePoids.map((poid) => ({ poid, url: programUrl(poid) })),
          referenceCourseCount: reference.size,
          candidatesConsidered: candidates.length,
          candidatesScanned: rows.length,
          rows: rows.map((row) => ({
            ...row,
            school: schoolOf.get(row.poid) ?? null,
            url: programUrl(row.poid),
          })),
        },
        null,
        1,
      )}\n`,
    );

    const reviewPath = path.join(ROOT, "data/raw", YEAR, "overlap-review.json");
    let review: Pick[] = REVIEW;
    try {
      review = JSON.parse(readFileSync(reviewPath, "utf8")) as Pick[];
    } catch {
      review = [];
    }
    if (review.length === 0) {
      console.log("Top 25 by overlap:");
      for (const row of rows.slice(0, 25)) {
        console.log(
          `${String(row.overlapCourses.length).padStart(3)} courses ${String(row.overlapUnits).padStart(4)} units  ${row.name}`,
        );
      }
      console.log(`Write ${path.relative(ROOT, reviewPath)} to choose, then run again.`);
      return;
    }

    const decided = new Map(review.map((item) => [item.name, item]));
    const kept = rows.filter((row) => decided.get(row.name)?.keep).slice(0, 6);
    const reserves = rows
      .filter((row) => !kept.includes(row) && decided.get(row.name)?.keep !== false)
      .slice(0, 3);
    const skipped = rows.slice(0, 25).filter((row) => decided.get(row.name)?.keep === false);

    const toOverlap = (row: OverlapRow) => ({
      distinctCoursesShared: row.overlapCourses.length,
      unitsShared: row.overlapUnits,
      courses: row.overlapCourses,
      coursesListedByProgram: row.listedCourses,
    });

    const programs: ListedProgram[] = [
      ...resolved.flatMap(({ request, entries: matched }): ListedProgram[] =>
        matched.length === 0
          ? [
              {
                id: slug(request.requestedName),
                role: request.role,
                combo: request.combo,
                requestedName: request.requestedName,
                requestedType: request.requestedType,
                status: request.status,
                catalogueName: null,
                school: null,
                kind: null,
                degree: null,
                url: null,
                poid: null,
                catalogueYear: YEAR,
                note: request.note,
                closestEntries: (request.closest ?? []).map((name) => {
                  const hit = byName(entries, name);
                  return { name, url: hit ? programUrl(hit.poid) : null, school: hit?.school ?? null };
                }),
                overlap: null,
                selected: false,
              },
            ]
          : matched.map((entry, index) => ({
              id: slug(entry.name),
              role: request.role,
              combo: request.combo,
              requestedName: request.requestedName,
              requestedType: request.requestedType,
              status: request.status,
              catalogueName: entry.name,
              school: entry.school,
              kind: entry.kind,
              degree: entry.degree,
              url: programUrl(entry.poid),
              poid: entry.poid,
              catalogueYear: YEAR,
              note: request.note,
              closestEntries: (request.closest ?? []).map((name) => {
                const hit = byName(entries, name);
                return { name, url: hit ? programUrl(hit.poid) : null, school: hit?.school ?? null };
              }),
              overlap: null,
              selected: index === 0,
            })),
      ),
      ...kept.map((row): ListedProgram => {
        const entry = entries.find((item) => item.poid === row.poid)!;
        return {
          id: slug(entry.name),
          role: "overlap_pick" as Role,
          combo: null,
          requestedName: null,
          requestedType: entry.kind === "minor" ? ("minor" as const) : ("major" as const),
          status: "found" as const,
          catalogueName: entry.name,
          school: entry.school,
          kind: entry.kind,
          degree: entry.degree,
          url: programUrl(entry.poid),
          poid: entry.poid,
          catalogueYear: YEAR,
          note: decided.get(row.name)?.reason ?? "",
          closestEntries: [],
          overlap: toOverlap(row),
          selected: true,
        };
      }),
    ];

    const output = {
      catalogueYear: YEAR,
      catoid: CATOID_2026_2027,
      checkedOn: CHECKED_ON,
      catalogueEditionUrl: "https://catalogue.usc.edu/misc/catalog_list.php?catoid=22",
      programIndexUrl: contentUrl(PROGRAMS_NAVOID),
      programsBySchoolUrl: contentUrl(PROGRAMS_BY_SCHOOL_NAVOID),
      overlapMethod: {
        reference: "Every course code printed anywhere in the requirements of Computer Science/Business Administration (BS) or Computational Neuroscience (BS), options included.",
        count: "For each undergraduate major or minor in the 2026-2027 index that is not already named above, the distinct course codes printed anywhere in its requirements that are also in the reference set, and the sum of the units the page prints beside them (the first number when a range is printed).",
        sort: "Distinct courses shared, then units shared, then name.",
        candidatesConsidered: candidates.length,
        candidatesScanned: rows.length,
        caveat: "A program that prints a long list of electives scores higher than one with the same number of required courses. A person read the ranked table and decisions are recorded under skippedAboveSixth.",
        scanFile: `data/raw/${YEAR}/overlap-scan.json`,
      },
      notFoundAsNamed: programs.filter((item) => item.status === "not_found_as_named"),
      needsHumanDecision: programs
        .filter((item) => item.status !== "found" && item.role !== "overlap_pick")
        .map((item) => ({ id: item.id, requestedName: item.requestedName, status: item.status, note: item.note })),
      programs,
      reserves: reserves.map((row) => ({
        name: row.name,
        url: programUrl(row.poid),
        school: schoolOf.get(row.poid) ?? null,
        ...toOverlap(row),
      })),
      skippedAboveSixth: skipped.map((row) => ({
        name: row.name,
        url: programUrl(row.poid),
        ...toOverlap(row),
        reason: decided.get(row.name)?.reason ?? "",
      })),
    };
    writeFileSync(path.join(ROOT, "data/program-list.json"), `${JSON.stringify(output, null, 2)}\n`);
    console.log(`wrote data/program-list.json with ${programs.length} entries`);
  } finally {
    await pages.dispose();
  }
}

void pageFor;
void main();
