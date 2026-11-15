import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { CataloguePages } from "./fetch";
import { buildCourses, buildPrograms } from "./build";
import { buildPolicy } from "./policy";

/**
 * Refetch the 2026-2027 catalogue pages this dataset was built from, rebuild the
 * JSON, and print what changed. The catalogue id (catoid 22) is the 2026-2027
 * edition. Another year needs that year's catoid before this script can fetch it.
 */

const YEAR = process.argv[2] ?? "2026-2027";
if (YEAR !== "2026-2027") {
  console.error(
    `This script fetches catoid 22, which is the 2026-2027 edition. It was asked for ${YEAR}. Add that year's catalogue id before refreshing it.`,
  );
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "../..");
const cache = path.join(root, "data/raw", YEAR);
const list = JSON.parse(readFileSync(path.join(root, "data/program-list.json"), "utf8")) as {
  programs: { url: string | null }[];
};

function snapshot(file: string): string | null {
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

async function main(): Promise<void> {
const coursesBefore = snapshot(path.join(root, "data/courses.json"));
const pages = new CataloguePages({ cacheDir: cache, pauseMs: 400 });
try {
  for (const program of list.programs) {
    if (program.url) await pages.get(program.url);
  }
  const htmlFiles = readdirSync(cache).filter((name) => name.includes("poid_"));
  const coids = new Set<string>();
  for (const name of htmlFiles) {
    const html = readFileSync(path.join(cache, name), "utf8");
    for (const match of html.matchAll(/showCourse\('22', '(\d+)'/g)) coids.add(match[1]);
  }
  for (const coid of coids) {
    await pages.get(`https://catalogue.usc.edu/preview_course_nopop.php?catoid=22&coid=${coid}`);
  }
} finally {
  await pages.dispose();
}

process.env.COURSE_CACHE = cache;
const { codes } = buildPrograms();
const courses = buildCourses(codes);
buildPolicy();

if (!coursesBefore) {
  console.log(`Wrote ${courses.length} courses. No previous courses.json to diff.`);
  process.exit(0);
}
const before = JSON.parse(coursesBefore) as { code: string; units: number }[];
const afterByCode = new Map(courses.map((course) => [course.code, course.units]));
const beforeByCode = new Map(before.map((course) => [course.code, course.units]));
const added = [...afterByCode.keys()].filter((code) => !beforeByCode.has(code));
const removed = [...beforeByCode.keys()].filter((code) => !afterByCode.has(code));
const changed = [...afterByCode.keys()].filter(
  (code) => beforeByCode.has(code) && beforeByCode.get(code) !== afterByCode.get(code),
);
console.log(`courses ${courses.length}; added ${added.length}; removed ${removed.length}; unit changes ${changed.length}`);
for (const code of changed) console.log(`  ${code}: ${beforeByCode.get(code)} -> ${afterByCode.get(code)}`);
execSync("git diff --stat -- data/programs data/courses.json data/policy-rules.json data/transfer-rules.json", {
  cwd: root,
  stdio: "inherit",
});
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
