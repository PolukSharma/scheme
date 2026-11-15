/**
 * Hand rules for the Tier 1 programs.
 *
 * Tier 1 is every program with selected: true in data/programs/index.json.
 * Neuroscience (BA) is stored and is not selected, so it is not in this file.
 * Each rule was read from the saved 2026-2027 catalogue page. Course pools for
 * a flat list are the course lines under that heading; the count is checked
 * against the number recorded here. Groups joined by "or" or "and" are written
 * out. data/programs is not read.
 */

import { all, count, course, one, type Atom, type CourseAtom } from "./atoms";
import { courseCodes, headingMap, requireCodes, type LoadedPage, type PageHeading } from "./page-tree";

export interface HandGrade {
  minimum: "C" | "C-";
  /** "named" uses codes. "major" applies to every course named in the atom. */
  scope: "named" | "major";
  codes: string[];
  quote: string;
}

export interface HandProgram {
  id: string;
  degreeUnits: number | null;
  quote: string;
  grade: HandGrade | null;
  root: Atom;
}

const c = course;

function listed(map: Map<string, PageHeading>, path: string, expected: number): CourseAtom[] {
  const heading = map.get(path);
  if (!heading) throw new Error(`Missing heading ${path}`);
  return requireCodes(heading, expected).map((code) => course(code));
}

function flat(map: Map<string, PageHeading>, path: string, expected: number): Atom {
  return all(...listed(map, path, expected));
}

function pick(map: Map<string, PageHeading>, path: string, expected: number, n: number, minUnits?: number): Atom {
  return count(n, listed(map, path, expected), minUnits);
}

export function handProgram(page: LoadedPage): HandProgram {
  const map = headingMap(page);
  const built = builders[page.id];
  if (!built) throw new Error(`No hand rule for ${page.id}`);
  return built(map);
}

const builders: Record<string, (map: Map<string, PageHeading>) => HandProgram> = {
  "computer-science-bs": cs,
  "computer-science-business-administration-bs": csba,
  "computer-engineering-and-computer-science-bs": cecs,
  "artificial-intelligence-bs": aiBs,
  "artificial-intelligence-applications-minor": aiApp,
  "law-and-regulation-of-artificial-intelligence-minor": law,
  "computational-neuroscience-bs": compNeuro,
  "neuroscience-bs": neuroBs,
  "quantitative-biology-bs": qbio,
  "biological-sciences-ba": bio,
  "cognitive-science-ba": cogSci,
  "applied-and-computational-mathematics-ba": mathBa,
};

function cs(map: Map<string, PageHeading>): HandProgram {
  return {
    id: "computer-science-bs",
    degreeUnits: 128,
    quote: "The minimum requirement for the degree is 128 units.",
    grade: {
      minimum: "C",
      scope: "named",
      codes: ["CSCI 102L", "CSCI 103L", "CSCI 104L", "CSCI 170", "CSCI 201"],
      quote:
        "A grade of C (2.0) or better is required for each of the core courses CSCI 102L, CSCI 103, CSCI 170, CSCI 104 and CSCI 201. The course list prints CSCI 103L and CSCI 104L.",
    },
    root: all(
      flat(map, "Composition/Writing Requirements (8 Units)", 2),
      { type: "unlisted", units: 20, label: "General Education (20 Units)" },
      flat(map, "Pre-Major Requirements (30 Units) / Engineering (2 units)", 1),
      all(
        c("MATH 125g"),
        one(c("MATH 126g"), c("MATH 129")),
        one(c("MATH 225"), c("MATH 235")),
        one(c("MATH 226g"), c("MATH 229")),
      ),
      flat(map, "Pre-Major Requirements (30 Units) / Statistics and Probability (4 units)", 1),
      one(c("BISC 120Lg"), c("BISC 121Lg"), c("BISC 220Lg")),
      one(c("CHEM 105aLg"), c("CHEM 115aLg"), c("PHYS 151Lg"), c("PHYS 161Lg")),
      flat(map, "Major Requirements (66 Units) / Computer Science (46 units)", 12),
      flat(map, "Major Requirements (66 Units) / Electrical Engineering (4 units)", 1),
      {
        type: "set",
        depts: ["CSCI"],
        levelMin: 300,
        levelMax: 499,
        minCount: 4,
        minUnits: 16,
        excludeForced: true,
        label: "Core Electives (16 units). Take at least four 300- or 400-level CSCI courses.",
      },
      flat(map, "Practicum (0 units)", 1),
      { type: "unlisted", units: 4, label: "Free Electives (4 Units)" },
    ),
  };
}

function csba(map: Map<string, PageHeading>): HandProgram {
  return {
    id: "computer-science-business-administration-bs",
    degreeUnits: 128,
    quote: "The minimum requirement for the degree is 128 units.",
    grade: {
      minimum: "C",
      scope: "named",
      codes: ["CSCI 102L", "CSCI 103L", "CSCI 104L", "CSCI 170", "CSCI 201"],
      quote:
        "A grade of C (2.0) or better is required for each of the core courses CSCI 102L, CSCI 103, CSCI 170, CSCI 104 and CSCI 201. The course list prints CSCI 103L and CSCI 104L.",
    },
    root: all(
      flat(map, "Composition/Writing Requirements (8 Units)", 2),
      { type: "unlisted", units: 24, label: "General Education (24 Units)" },
      flat(map, "Pre-Major Requirements (14 Units) / Engineering (2 units)", 1),
      all(c("MATH 125g"), one(c("MATH 126g"), c("MATH 129"))),
      one(c("BISC 120Lg"), c("BISC 121Lg"), c("CHEM 105aLg"), c("CHEM 115aLg"), c("PHYS 151Lg"), c("PHYS 161Lg")),
      one(c("BUAD 310g"), c("BUAD 312g"), c("EE 364"), c("MATH 407")),
      one(c("EE 141L"), c("MATH 225"), c("MATH 235")),
      flat(map, "Major Requirements (82 Units) / Computer Science Requirements (30 units)", 8),
      all(
        c("ACCT 410x"),
        c("BUAD 302"),
        c("BUAD 304"),
        c("BUAD 306"),
        c("BUAD 307"),
        one(c("BUAD 311"), c("BUAD 313")),
        c("BUAD 497"),
        c("ECON 351x"),
        c("ECON 352x"),
      ),
      {
        type: "set",
        depts: ["CSCI"],
        levelMin: 300,
        levelMax: 499,
        minCount: 1,
        minUnits: 4,
        excludeForced: true,
        label: "Take at least one 4-unit 300- or 400-level CSCI course.",
      },
      {
        type: "set",
        depts: ["ACCT", "BAEP", "BUCO", "BUAD", "DSO", "FBE", "MKT", "MOR", "RISK"],
        levelMin: 300,
        levelMax: 499,
        minUnits: 4,
        excludeForced: true,
        label: "Take at least four units of 300- or 400-level Marshall courses.",
      },
      flat(map, "Practicum (0 units)", 1),
    ),
  };
}

function cecs(map: Map<string, PageHeading>): HandProgram {
  return {
    id: "computer-engineering-and-computer-science-bs",
    degreeUnits: 128,
    quote: "The requirement for the degree is 128 units. That total fits one 20-unit track, not both.",
    grade: {
      minimum: "C",
      scope: "named",
      codes: ["CSCI 102L", "CSCI 103L", "CSCI 104L", "CSCI 170", "CSCI 201"],
      quote:
        "A grade of C (2.0) or better is required for each of the core courses CSCI 102L, CSCI 103, CSCI 170, CSCI 104 and CSCI 201. The course list prints CSCI 103L and CSCI 104L.",
    },
    root: all(
      flat(map, "Composition/Writing Requirements (8 Units)", 2),
      { type: "unlisted", units: 24, label: "General Education (24 Units)" },
      flat(map, "Pre-Major Requirements (30 Units) / Engineering (2 units)", 1),
      all(
        c("MATH 125g"),
        one(c("MATH 126g"), c("MATH 129")),
        one(c("MATH 225"), c("EE 141L"), c("MATH 235")),
        one(c("MATH 226g"), c("MATH 229")),
      ),
      flat(map, "Pre-Major Requirements (30 Units) / Statistics and Probability (4 units)", 1),
      one(all(c("PHYS 151Lg"), c("PHYS 152L")), all(c("PHYS 161Lg"), c("PHYS 162L"))),
      all(
        c("CSCI 102L"),
        c("CSCI 103L"),
        c("CSCI 104L"),
        c("CSCI 170"),
        c("CSCI 270"),
        c("CSCI 350"),
        c("EE 109L"),
        c("EE 250L"),
        c("EE 354L"),
        c("EE 457"),
        one(c("CSCI 360"), c("CSCI 467"), c("EE 460")),
      ),
      one(
        all(
          c("CSCI 201"),
          c("CSCI 353"),
          c("EE 451"),
          c("EE 454L"),
          one(c("CSCI 401"), c("EE 459Lx"), c("EE 496")),
        ),
        all(
          c("EE 202L"),
          c("EE 301"),
          one(c("EE 454L"), c("EE 477L")),
          one(c("EE 459Lx"), c("EE 496")),
          {
            type: "set",
            depts: ["CSCI", "EE"],
            levelMin: 300,
            levelMax: 499,
            minUnits: 4,
            excludeForced: true,
            label: "Embedded track technical elective, 4 units of 300- or 400-level CSCI or EE.",
          },
        ),
      ),
      flat(map, "Practicum (0 units)", 1),
      { type: "unlisted", units: 4, label: "Free Electives (4 units)" },
    ),
  };
}

function aiBs(map: Map<string, PageHeading>): HandProgram {
  return {
    id: "artificial-intelligence-bs",
    degreeUnits: 128,
    quote: "The minimum requirement for the degree is 128 units.",
    grade: {
      minimum: "C",
      scope: "named",
      codes: ["CSCI 113x", "CSCI 114x", "CSCI 170", "EE 141L", "MATH 125g", "MATH 126g", "MATH 129", "MATH 226g", "MATH 229"],
      quote:
        "A grade of C (2.0) or better is required for CSCI 113x, CSCI 114x, CSCI 170, and the Mathematical Foundations courses.",
    },
    root: all(
      flat(map, "Composition/Writing Requirements (8 units)*", 2),
      { type: "unlisted", units: 20, label: "General Education (20 units)" },
      flat(map, "Pre-Major Requirements (28 units) / Engineering (4 units)", 2),
      all(c("EE 141L"), c("MATH 125g"), one(c("MATH 126g"), c("MATH 129")), one(c("MATH 226g"), c("MATH 229"))),
      pick(map, "Pre-Major Requirements (28 units) / Basic Science (8 units) / Biology Requirement (4 units)", 8, 1),
      one(c("PHYS 151Lg"), c("PHYS 161Lg")),
      flat(map, "Core Lower-Division Requirements (30 units) / Programming and Discrete Methods (12 Units)***", 3),
      flat(map, "Core Lower-Division Requirements (30 units) / Probability and Statistics (8 units)", 2),
      flat(map, "Core Lower-Division Requirements (30 units) / Embedded Systems (4 units)", 1),
      flat(map, "Core Lower-Division Requirements (30 units) / AI Core (6 units)", 2),
      all(c("CSCI 360"), one(c("CSCI 467"), c("EE 460")), c("EIS 370"), c("ISE 330")),
      one(
        all(
          c("CSCI 201"),
          c("CSCI 401"),
          pick(
            map,
            "Choose one of the following three tracks (24 units) / Computing Foundations and Applications Track / Choose four of the following classes (16 units):",
            7,
            4,
            16,
          ),
        ),
        all(
          flat(map, "Choose one of the following three tracks (24 units) / Hardware Systems for AI Track", 5),
          pick(
            map,
            "Choose one of the following three tracks (24 units) / Hardware Systems for AI Track / Choose one of the following (4 units)",
            5,
            1,
            4,
          ),
        ),
        all(
          flat(map, "Choose one of the following three tracks (24 units) / AI Systems and Operations Engineering Track", 5),
          pick(
            map,
            "Choose one of the following three tracks (24 units) / AI Systems and Operations Engineering Track / Choose one of the following (4 units)",
            4,
            1,
            4,
          ),
        ),
      ),
      flat(map, "Practicum (0 units)", 1),
      { type: "unlisted", units: 2, label: "Free Elective (2 units)" },
    ),
  };
}

function aiApp(map: Map<string, PageHeading>): HandProgram {
  return {
    id: "artificial-intelligence-applications-minor",
    degreeUnits: null,
    quote: "The minor requires a minimum of 18-20 units.",
    grade: null,
    root: all(
      flat(map, "Core Requirements (12 units)", 3),
      one(
        flat(map, "Programming Fundamentals (2-4 units) / CSCI course:", 1),
        all(one(c("TAC 115"), c("TAC 116")), c("TAC 216")),
      ),
      pick(map, "Electives (4 units)", 3, 1, 4),
    ),
  };
}

function law(map: Map<string, PageHeading>): HandProgram {
  return {
    id: "law-and-regulation-of-artificial-intelligence-minor",
    degreeUnits: 20,
    quote: "The minor totals 20 units; 8 required core units, 8 LAW elective units, and 4 other elective units.",
    grade: null,
    root: all(
      flat(map, "Required Core Courses (8 units)", 2),
      pick(map, "Law Electives (8 units)", 5, 2, 8),
      one(
        c("COMM 309"),
        c("CSCI 113x"),
        c("EIS 370"),
        c("PHIL 265g"),
        all(one(c("TAC 115"), c("TAC 116")), c("TAC 216")),
        c("TAC 259"),
      ),
    ),
  };
}

function compNeuro(map: Map<string, PageHeading>): HandProgram {
  const graduate = listed(map, "Graduate Courses", 15).map((item) => item.code);
  return {
    id: "computational-neuroscience-bs",
    degreeUnits: 128,
    quote:
      "Twelve core courses (45 units) and six or seven electives (minimum 22 units), minimum 67 units in the major. The degree requires a minimum of 128 units.",
    grade: {
      minimum: "C-",
      scope: "major",
      codes: [],
      quote: "A grade of C- or higher is required to count toward major requirements.",
    },
    root: all(
      all(
        one(c("BISC 220Lg"), c("BISC 221Lg")),
        one(c("CHEM 103Lgx"), c("CHEM 105aLg")),
        c("MATH 125g"),
        c("MATH 126g"),
        one(c("PHYS 135aLg"), c("PHYS 151Lg")),
        one(c("PHYS 135bL"), c("PHYS 152L")),
        one(c("HP 340Lg"), c("MATH 208x"), c("MATH 307"), c("PSYC 274Lg"), c("QBIO 305g")),
        c("BISC 421"),
        c("NEUR 199"),
        c("PSYC 100Lg"),
        c("BISC 407"),
        c("NEUR 408"),
      ),
      pick(map, "Computational Area / Basic Computational Skills (2-4 units)", 8, 1),
      pick(map, "Computational Area / Computational Courses (8 units)", 17, 2, 8),
      count(1, listed(map, "Biological Area (4 units)", 13), 4),
      count(1, listed(map, "Behavioral Area (4 units)", 15), 4),
      count(1, listed(map, "Other Electives (4 units)", 5), 4),
      { type: "optional", label: "Graduate courses may be substituted with permission. They are not required.", codes: graduate },
    ),
  };
}

function neuroBs(map: Map<string, PageHeading>): HandProgram {
  const graduate = listed(map, "Electives (20 units) / Graduate Courses", 11).map((item) => item.code);
  return {
    id: "neuroscience-bs",
    degreeUnits: 128,
    quote: "14 core courses (minimum 53 units) and five or six electives (minimum 20 units). The degree requires 128 units.",
    grade: {
      minimum: "C-",
      scope: "major",
      codes: [],
      quote: "A grade of C- or higher is required to count toward major requirements.",
    },
    root: all(
      all(
        one(c("BISC 220Lg"), c("BISC 221Lg")),
        one(c("CHEM 105aLg"), c("CHEM 115aLg")),
        one(c("CHEM 105bL"), c("CHEM 115bL")),
        c("CHEM 322aL"),
        c("CHEM 322bL"),
        c("MATH 125g"),
        one(c("PHYS 135aLg"), c("PHYS 151Lg")),
        one(c("PHYS 135bL"), c("PHYS 152L")),
        c("PSYC 100Lg"),
        one(
          c("BUAD 310g"),
          c("ECON 317"),
          c("HP 340Lg"),
          c("MATH 208x"),
          c("MATH 307"),
          c("MATH 407"),
          c("PSYC 274Lg"),
          c("QBIO 305g"),
          c("QBIO 310"),
        ),
        c("BISC 421"),
        c("NEUR 199"),
        c("BISC 407"),
        c("BISC 408"),
      ),
      count(1, listed(map, "Electives (20 units) / Elective Courses", 67), 20),
      { type: "optional", label: "A graduate class may be substituted for an upper-division elective. It is not required.", codes: graduate },
    ),
  };
}

function qbio(map: Map<string, PageHeading>): HandProgram {
  const track2 = map.get("Core Courses (38 units) / Required Foundational Computing Courses (12 units) / 2.");
  const track3 = map.get("Core Courses (38 units) / Required Foundational Computing Courses (12 units) / 3.");
  if (!track2 || !track3) throw new Error("missing quantitative biology computing track");
  const track2Codes = courseCodes(track2, 5);
  const track3Codes = courseCodes(track3, 5);
  if (track2Codes.join("|") !== ["CSCI 113x", "CSCI 114x", "QBIO 401", "QBIO 460", "QBIO 465"].join("|")) {
    throw new Error(`Track 2 lines changed: ${track2Codes.join(", ")}`);
  }
  if (track3Codes.join("|") !== ["CSCI 103L", "CSCI 114x", "QBIO 401", "QBIO 460", "QBIO 465"].join("|")) {
    throw new Error(`Track 3 lines changed: ${track3Codes.join(", ")}`);
  }
  return {
    id: "quantitative-biology-bs",
    degreeUnits: null,
    quote: "The page does not print one degree total. The listed blocks are 38 + 12 + 8 + 8 + 6 units.",
    grade: null,
    root: all(
      flat(map, "Core Courses (38 units) / Required Introductory Course (2 units)", 1),
      all(
        one(c("BISC 120Lg"), c("BISC 121Lg")),
        one(c("BISC 220Lg"), c("BISC 221Lg")),
        one(c("CHEM 105aLg"), c("CHEM 115aLg")),
        c("MATH 125g"),
        one(c("PHYS 135aLg"), c("PHYS 151Lg"), c("PHYS 161Lg"), c("PHYS 171Lg")),
        one(c("QBIO 310"), c("MATH 307")),
      ),
      one(
        flat(map, "Core Courses (38 units) / Required Foundational Computing Courses (12 units) / 1.", 3),
        all(
          c("CSCI 113x"),
          c("CSCI 114x"),
          one(c("QBIO 401"), c("QBIO 460"), c("QBIO 465")),
        ),
        all(
          c("CSCI 103L"),
          c("CSCI 114x"),
          one(c("QBIO 401"), c("QBIO 460"), c("QBIO 465")),
        ),
      ),
      count(
        3,
        [
          one(c("CHEM 105bL"), c("CHEM 115bL")),
          c("CHEM 322aL"),
          c("CHEM 322bL"),
          c("CSCI 270"),
          one(c("MATH 126g"), c("MATH 127"), c("MATH 129")),
          one(c("MATH 225"), c("MATH 245")),
          one(c("MATH 226g"), c("MATH 227"), c("MATH 229")),
          c("MATH 407"),
          one(c("MATH 308"), c("MATH 408")),
          one(c("PHYS 135bL"), c("PHYS 152L"), c("PHYS 162L"), c("PHYS 172L")),
          c("QBIO 401"),
          c("QBIO 460"),
          c("QBIO 465"),
        ],
        12,
      ),
      pick(map, "Capstone Courses (8 units)", 4, 2, 8),
      count(2, qbioUpperOptions(), 8),
      {
        type: "units",
        minUnits: 6,
        label: "Research Experience (6 units). Honors students also take QBIO 493 and QBIO 494; those two are not required of everyone.",
        options: [c("QBIO 490x"), c("QBIO 493"), c("QBIO 494")],
      },
    ),
  };
}

function qbioUpperOptions(): Atom[] {
  const singles = [
    "BISC 300L",
    "BISC 307L",
    "BISC 313L",
    "BISC 315L",
    "BISC 320Lg",
    "BISC 325",
    "BISC 403",
    "BISC 406L",
    "BISC 407",
    "BISC 408",
    "BISC 410",
    "BISC 411",
    "BISC 421",
    "BISC 423",
    "BISC 424",
    "BISC 434",
    "BISC 435",
    "BISC 450L",
    "BISC 473L",
    "BME 430",
    "CSCI 360",
    "CSCI 467",
    "ECON 460",
    "LING 486",
    "LING 487",
    "MATH 447",
    "MATH 466",
    "MATH 467",
    "PHYS 444",
    "PSYC 450",
    "QBIO 401",
    "QBIO 460",
    "QBIO 465",
    "QBIO 475",
    "QBIO 478",
    "QBIO 479L",
    "QBIO 481",
    "QBIO 482",
    "QBIO 499",
    "SCRM 487",
  ];
  return [one(c("BISC 330L"), c("BISC 312x"), c("CHEM 350")), ...singles.map((code) => c(code))];
}

function bio(map: Map<string, PageHeading>): HandProgram {
  return {
    id: "biological-sciences-ba",
    degreeUnits: 128,
    quote: "Total required units: 128. Free elective units: 10-11.",
    grade: {
      minimum: "C-",
      scope: "named",
      codes: ["BISC 120Lg", "BISC 121Lg", "BISC 220Lg", "BISC 221Lg", "BISC 320Lg", "BISC 325", "BISC 330L"],
      quote: "Students receive a grade no lower than C- in their five core courses.",
    },
    root: all(
      all(one(c("BISC 120Lg"), c("BISC 121Lg")), one(c("BISC 220Lg"), c("BISC 221Lg"))),
      all(
        one(c("CHEM 105aLg"), c("CHEM 107Lg"), c("CHEM 115aLg")),
        one(c("CHEM 105bL"), c("CHEM 108L"), c("CHEM 115bL")),
      ),
      all(one(c("CHEM 322aL"), c("CHEM 325aL")), one(c("CHEM 322bL"), c("CHEM 325bL"))),
      flat(map, "Collateral Sciences Courses (32 units) / Calculus Requirement: 4 units", 1),
      one(c("MATH 208x"), c("QBIO 305g"), c("QBIO 310")),
      all(one(c("PHYS 135aLg"), c("PHYS 151Lg")), one(c("PHYS 135bL"), c("PHYS 152L"))),
      count(1, listed(map, "Introduction to Research-Active Faculty (1 to 2 units)", 3), 1),
      flat(map, "Upper-Division BISC Core Courses (12 units)", 3),
      count(1, listed(map, "Upper-Division Electives (8 units)", 63), 8),
      { type: "unlisted", units: 10, label: "Free elective units: 10-11" },
      {
        type: "optional",
        label: "Honors adds BISC 493x and BISC 494x. It is not required for the BA.",
        codes: ["BISC 493x", "BISC 494x"],
      },
    ),
  };
}

function cogSci(map: Map<string, PageHeading>): HandProgram {
  const tierPath = "Flexible Core Requirements (Five Courses) / Two courses from:";
  const tier = map.get(tierPath);
  if (!tier) throw new Error(tierPath);
  const tierCodes = courseCodes(tier, 14).filter((code) => code !== "PHIL 220" && code !== "PHIL 222g");
  return {
    id: "cognitive-science-ba",
    degreeUnits: null,
    quote: "Four fixed core courses, two Tier 1 courses, three Tier 2 courses, and three electives. Suggested tracks are suggestions only.",
    grade: null,
    root: all(
      flat(map, "Core Requirements (Four Courses)", 4),
      count(2, [...tierCodes.map((code) => c(code)), one(c("PHIL 220"), c("PHIL 222g"))]),
      pick(map, "Flexible Core Requirements (Five Courses) / Three courses from:", 32, 3),
      pick(map, "Electives (Three Courses)", 76, 3, 10),
      { type: "optional", label: "Suggested tracks are suggestions only.", codes: [] },
    ),
  };
}

function mathBa(map: Map<string, PageHeading>): HandProgram {
  const upper = listed(map, "Three Electives with Significant Quantitative Content / List A - upper division", 40).map((item) => item.code);
  const lower = listed(map, "Three Electives with Significant Quantitative Content / List B - lower division", 17).map((item) => item.code);
  return {
    id: "applied-and-computational-mathematics-ba",
    degreeUnits: null,
    quote: "The page does not print one degree total.",
    grade: {
      minimum: "C",
      scope: "named",
      codes: ["MATH 407", "MATH 458"],
      quote: "MATH 407 and MATH 458 are required with a grade of C or better.",
    },
    root: all(
      all(
        c("MATH 125g"),
        one(c("MATH 126g"), c("MATH 127"), c("MATH 129")),
        one(c("MATH 225"), c("MATH 245")),
        one(c("MATH 226g"), c("MATH 227"), c("MATH 229")),
      ),
      flat(map, "Upper-Division Math Requirements", 2),
      pick(map, "Upper-Division Math Requirements / Upper-Division Math Electives", 14, 4),
      pick(map, "In Computing", 8, 1),
      { type: "outside", n: 3, minOutside: 2, minUpper: 1, upper, lower, label: "Three electives, at least two outside MATH, one of them upper-division." },
    ),
  };
}
