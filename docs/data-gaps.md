# Data gaps

`docs/data-sources.md` is not in this repository. Tier 1 here is the set of programs
the catalogue pass already recorded as the team's current programs and switch targets
for 2026-2027. Overlap picks were not encoded. Nothing below is a requirement that the
catalogue page does not state.

A program is `verified: false` when the minimum units recomputed from its tree are not
the units the page states, or when a stated condition could not be stored as its own node.
The recomputation uses the lowest printed unit value on each course and, for a choice,
the cheapest way to satisfy the count. A `unit_min` node contributes its floor when that
floor is higher than the cheapest child.

## Schema

Catalogue codes such as `CHEM 105aLg` and `CSCI 103L` do not match the original
`DEMO 101` pattern, which allowed only one optional capital letter. `contracts/course.ts`
now allows the suffix the catalogue prints. `ENGR 495` is printed as 0 units, so a course
may be 0 units. `DEMO 101` still matches.

## Not encoded

- AI Applications as a specialization of the Computer Science/Business Administration major.
  The 2026-2027 program index has no specialization, track, or emphasis by that name.
  The page for that major does not mention one. No program file was substituted.
- Neuroscience (BA), https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31869.
  The catalogue has both a BA and a BS. This file set includes the BS.
- Overlap picks from the earlier catalogue scan (Quantitative Biology, Biological Sciences,
  Computer Engineering and Computer Science, Cognitive Science, Applied and Computational
  Mathematics, and Artificial Intelligence) are not in this Tier 1 set.

## Course records

Course codes follow the catalogue spelling, including suffixes such as `aLg`.
`both` means the page prints fall and spring. When it also prints summer (`FaSpSm`),
the source text keeps that word and `offering` stays `both`.

Summer-only courses, stored as `unknown` because the offering enum has no summer value: GERO 494.

Term pattern not printed, stored as `unknown` (26 courses): BPSI 405, CSCI 350, ECON 405, EE 141L, ENGR 495, GERO 494, HBIO 308, HP 409, LAW 210p, PHYS 171Lg, PSYC 301L, PSYC 304L, PSYC 305, PSYC 320, PSYC 337L, PSYC 420, PSYC 424, PSYC 425, PSYC 426, PSYC 434, PSYC 438, PSYC 450, PSYC 452, RXRS 403, RXRS 405, RXRS 412.

Unit ranges. The record stores the lowest printed number and `verified` is false:

- BISC 490x (BISC 490x Directed Research Units: 1, 2, 3, 4, 5, 6, 7, 8)
- BISC 499 (BISC 499 Special Topics Units: 2, 3, 4)
- NEUR 490x (NEUR 490x Directed Research Units: 1, 2, 3, 4, 5, 6, 7, 8)

Prerequisite sentences that were not a complete boolean tree. `prerequisites` is null
and `verified` is false. The sentence remains in `source.text`:

BISC 221Lg, BISC 307L, BISC 313L, BISC 406L, BISC 408, BISC 426, BUAD 497, CHEM 105aLg, CHEM 115bL, CSCI 114x, CSCI 445L, CSCI 455x, DSCI 352, ECON 317, ECON 351x, ECON 405, MATH 125g, MATH 208x, MATH 227, MATH 229, MATH 307, MATH 308, MEDS 320, PHYS 135aLg, PHYS 135bL, PSYC 301L, PSYC 304L, PSYC 305, PSYC 326, PSYC 337L, PSYC 420, PSYC 434, PSYC 437, PSYC 438, SCRM 487, TAC 216, TAC 259, TAC 359, TAC 365, TAC 429, TAC 449, TAC 459, WRIT 340.

## Programs

### computer-science-business-administration-bs

Catalogue: Total units: 128

Tree minimum: 104. Stated total stored on the program: 128. `verified`: false.

The difference from 128 is the block or blocks left out below. They name a unit count and do not list courses, so they are not in the tree.

- Left out a block with no course list: General Education (24 Units) General Education Units: 24.
- The schema has no level ceiling, so a 300- or 400-level set is not limited to those levels. Computer Science Elective Take at least one 4-unit 300- or 400-level CSCI course.
- Business electives are at least four units from ACCT, BAEP, BUCO, BUAD, DSO, FBE, MKT, MOR, or RISK. The page allows those units to be mixed across prefixes. The tree lists one department set per prefix, so choosing one set does not mix prefixes.
- The schema has no level ceiling, so a 300- or 400-level set is not limited to those levels. Business Elective(s) Take at least four units of 300- or 400-level courses offered by the Marshall School, specifically with a prefix of ACCT, BAEP, BUCO, BUAD, DSO, FBE, MKT, MOR or RISK, and selected in consultation with an adviser.

### law-and-regulation-of-artificial-intelligence-minor

Catalogue: The Law and Regulation of Artificial Intelligence minor totals 20 units; 8 required core units, 8 LAW elective units, and 4 other elective units.

Tree minimum: 20. Stated total stored on the program: 20. `verified`: true.

### computational-neuroscience-bs

Catalogue: The degree requires a minimum of 128 units.

The page also states: The major requires twelve core courses (45 units) and six or seven electives (minimum 22 units) for a minimum total of 67 units.

Tree minimum: 63. Stated total stored on the program: 128. `verified`: false.

The listed core matches the page's 45 units. The elective areas, using the cheapest courses the tree allows, add 18, for 63. The page's elective minimum is 22. The tree does not enforce the sentence "Only one introductory programming course will be counted toward the major," so three 2-unit introductory courses can all count. The degree total of 128 is stated separately and the page does not itemize the units between 67 and 128.

- Not stored as its own node: Only one introductory programming course will be counted toward the major.
- BISC 490x prints a unit range. The course record keeps the lowest printed number.
- A unit floor of 4 is stored on a pool whose courses are not all the same size: Behavioral Area (4 units)
- NEUR 490x prints a unit range. The course record keeps the lowest printed number.
- Other electives say to take one additional course from the Computational, Biological, or Behavioral area, or 4 units of NEUR 490x. The node lists the extra courses printed under that heading and does not repeat every course from the other areas.
- Left out a graduate list the page allows only as a substitute, not as an extra requirement: Graduate Courses A graduate class from the following list may be substituted for an undergraduate computational course with the permission of the co-directors and instructor and with a minimum GPA of 3.3.

### artificial-intelligence-applications-minor

Catalogue: The minor requires a minimum of 18-20 units.

Tree minimum: 20. Stated total stored on the program: 18. `verified`: false.

The page says the minor is a minimum of 18-20 units. The 18-unit path waives TAC 115 or TAC 116 for prior Python experience. That waiver is not a node, so the tree's cheapest path is 20.

### neuroscience-bs

Catalogue: The degree requires a minimum of 128 units.

The page also states: The major requires 14 core courses (minimum 53 units) and five or six elective courses (minimum 20 units) for a minimum total of 73 units.

Tree minimum: 73. Stated total stored on the program: 128. `verified`: false.

The listed major requirements recompute to 73, the major minimum the page states. The degree minimum of 128 includes units the page does not list as courses.

- The page says a grade of C- or higher counts toward the major. That minimum is on the root node.
- Left out graduate courses the page allows as substitutes for an upper-division elective. The lab rule and the 4-unit cap on NEUR 490x are in the node quotation and are not separate nodes.
- Electives are five or six courses and at least 20 units, with a lab-or-490 rule and a cap of 4 units of NEUR 490x. The tree stores the minimum count and the 20-unit floor. It does not encode the lab rule, the cap, or the choice of a sixth course.

### computer-science-bs

Catalogue: Total Units: 128

Tree minimum: 104. Stated total stored on the program: 128. `verified`: false.

The difference from 128 is the block or blocks left out below. They name a unit count and do not list courses, so they are not in the tree.

- Left out a block with no course list: General Education (20 Units) General Education Units: 20.
- The schema has no level ceiling, so a 300- or 400-level set is not limited to those levels. Core Electives (16 units) Take at least four 300- or 400- level CSCI courses for a minimum of 16 units.
- Left out a block with no course list: Free Electives (4 Units).
