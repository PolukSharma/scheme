import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import type { PolicyRule } from "../../lib/types";

const YEAR = "2026-2027";
const ROOT = path.resolve(import.meta.dirname, "../..");

function pageText(file: string): string {
  const html = readFileSync(path.join(ROOT, "data/raw", YEAR, file), "utf8");
  return cheerio.load(html).text().replace(/\u00a0/g, " ").replace(/\s+/g, " ");
}

function take(page: string, pattern: RegExp): string {
  const found = pattern.exec(page);
  if (!found) throw new Error(`Quote not found: ${pattern}`);
  return found[0];
}

export function buildPolicy(): PolicyRule[] {
  const registration = pageText("catalogue_usc_edu_content_php_catoid_22_navoid_9131.html");
  const graduation = pageText("catalogue_usc_edu_content_php_catoid_22_navoid_9115.html");
  const registrationUrl = "https://catalogue.usc.edu/content.php?catoid=22&navoid=9131";
  const graduationUrl = "https://catalogue.usc.edu/content.php?catoid=22&navoid=9115";
  const normal = take(registration, /A normal academic load is 16 units per semester for undergraduate students[^.]+\./);
  const above18 = take(registration, /The university recommends that undergraduate students register for no more than 18 units[^.]+\./);
  const above20 = take(registration, /Permission to enroll in more than 20 units requires approval[^.]+\./);
  const minor = take(graduation, /Students must take at least 16 units, which are unique to the minor[^.]+\./);
  const catalogue = take(
    graduation,
    /Undergraduate students may elect to follow \(a\) the degree requirements in the catalogue current[\s\S]+?different catalogue years\./,
  );
  const quote = (
    id: string,
    name: string,
    summary: string,
    value: number | string | boolean | null,
    confirmed: boolean,
    url: string,
    text: string,
  ): PolicyRule => ({
    id,
    name,
    summary,
    value,
    confirmed,
    source: { url, catalogueYear: YEAR, text },
  });
  const rules: PolicyRule[] = [
    quote("undergraduate-normal-term-load", "Normal undergraduate term load", "A normal undergraduate load is 16 units in a semester.", 16, true, registrationUrl, normal),
    quote("undergraduate-recommended-maximum", "Recommended undergraduate maximum", "The university recommends that undergraduates register for no more than 18 units.", 18, true, registrationUrl, above18),
    quote("undergraduate-permission-above-20", "Permission above 20 units", "More than 20 units needs approval from the school or home department.", 20, true, registrationUrl, above20),
    quote("minor-units-unique-to-the-minor", "Units unique to a minor", "At least 16 units must count only toward the minor.", 16, true, graduationUrl, minor),
    quote("catalogue-year", "Catalogue year", "A student follows one catalogue year, with the exceptions printed on the graduation page.", YEAR, true, graduationUrl, catalogue),
    {
      id: "per-term-unit-cap",
      name: "Per-term unit cap",
      summary: "The registration page states a normal load, a recommended maximum, and a permission threshold. It does not state one hard cap.",
      value: null,
      confirmed: false,
      source: {
        url: registrationUrl,
        catalogueYear: YEAR,
        text: `${normal} ${above18} ${above20} The page states a normal load, a recommended maximum, and a permission threshold. It does not state one hard cap.`,
      },
    },
    {
      id: "courses-shared-by-two-majors",
      name: "Courses shared by two majors",
      summary: "The graduation page does not state a unit limit on courses shared by two majors.",
      value: null,
      confirmed: false,
      source: {
        url: graduationUrl,
        catalogueYear: YEAR,
        text: `${minor} ${catalogue} Neither sentence states a unit limit on courses shared by two majors.`,
      },
    },
  ];
  writeFileSync(path.join(ROOT, "data/policy-rules.json"), `${JSON.stringify(rules, null, 2)}\n`);
  return rules;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  console.log(`policy rules: ${buildPolicy().length}`);
}
