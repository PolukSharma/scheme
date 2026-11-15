# Independent check

Tier 1 is the twelve programs with `selected: true` in `data/programs/index.json`. Neuroscience (BA) is stored and is not in this table. The rules were read from the saved 2026-2027 catalogue pages. `data/programs` was used only as the tree the engine audits. No person has set `humanChecked`. STARS remains the official audit.

Overall: 58 of 126 checks passed (46%).

## Accuracy

| Program | Checks | Passed | Accuracy | Invented courses | Choice leaks | Grade faults | Plan faults |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Computer Science/Business Administration (BS) | 11 | 1 | 9% | 17 | 4 | 1 | 22 |
| Law and Regulation of Artificial Intelligence Minor | 10 | 9 | 90% | 0 | 0 | 0 | 1 |
| Computational Neuroscience (BS) | 14 | 4 | 29% | 15 | 0 | 1 | 25 |
| Artificial Intelligence Applications Minor | 10 | 10 | 100% | 0 | 0 | 0 | 0 |
| Neuroscience (BS) | 11 | 3 | 27% | 11 | 0 | 1 | 19 |
| Computer Science (BS) | 12 | 1 | 8% | 17 | 1 | 1 | 22 |
| Quantitative Biology (BS) | 8 | 5 | 63% | 0 | 0 | 0 | 3 |
| Biological Sciences (BA) | 11 | 6 | 55% | 7 | 0 | 1 | 8 |
| Computer Engineering and Computer Science (BS) | 9 | 1 | 11% | 19 | 2 | 1 | 26 |
| Cognitive Science (BA) | 8 | 6 | 75% | 0 | 0 | 0 | 5 |
| Applied and Computational Mathematics (BA) | 13 | 9 | 69% | 0 | 0 | 1 | 1 |
| Artificial Intelligence (BS) | 9 | 3 | 33% | 16 | 0 | 1 | 22 |

## Synthetic STARS fixtures

The three records are `data/samples/students.json`, built from `fixtures/stars/early.txt`, `fixtures/stars/mid.txt`, and `fixtures/stars/late.txt`. A row fails when a hand-required code is missing, a forbidden code is still remaining, the remaining list invents an off-page course, or the remaining list does not cover the hand rule.

| Student | Program | Result | Must remain | Must not remain |
| --- | --- | --- | --- | --- |
| sample-late-csba | computer-science-business-administration-bs | fail | CSCI 201, CSCI 270, CSCI 310, CSCI 401, MATH 125g, ACCT 410x | BISC 193 |
| sample-late-csba | law-and-regulation-of-artificial-intelligence-minor | pass | LAW 306 | none of the forbidden codes |
| sample-mid-neuro | computational-neuroscience-bs | fail | missing BISC 220Lg | TAC 116, BME 502, CSCI 561 |
| sample-mid-neuro | artificial-intelligence-applications-minor | pass | TAC 216, TAC 259, TAC 359, TAC 459 | none of the forbidden codes |
| sample-early-cs | computer-science-bs | fail | missing CSCI 103L | BISC 193, NEUR 199 |

## Defects

Ranked by how far a remaining list or a plan can move a student off the catalogue. Reproduce with `npm run accuracy`.

### 1. A block with no course list is stored as a course set that matches every catalogue course. The audit then schedules courses that are not on the program page, including 1-unit research courses, and those courses can hide a real requirement from coursesRemaining.

Severity: high. Id: `invented-courses`. Filed as #31.

Audit an empty Computer Science (BS) record. coursesRemaining includes BISC 193, BISC 199, NEUR 199, and QBIO 490x. None of those codes is printed on the computer science page. Give that student only CSCI 102L with A. Node computer-science-bs-27 stays unsatisfied, coursesRemaining omits CSCI 102L, and the general-education set computer-science-bs-4-prose lists CSCI 102L as applied. The same shape holds for C-.

### 2. A passing grade on a named requirement is applied to an open placeholder set, so the named node stays unsatisfied and the course disappears from coursesRemaining.

Severity: high. Id: `passing-grade-consumed`. Filed as #31.

An A, or a completed fixture course, leaves the named node open for: computer-science-business-administration-bs CSCI 102L A; sample-late-csba CSCI 102L, CSCI 103L, CSCI 170, CSCI 104L; computer-science-bs CSCI 102L A; sample-early-cs CSCI 102L; computer-engineering-and-computer-science-bs CSCI 102L A; artificial-intelligence-bs CSCI 113x A.

### 3. A finished course below the printed floor is treated as already done by the planner, so the required repeat is not scheduled.

Severity: high. Id: `retake-not-planned`. Filed as #32.

Computer Science/Business Administration: CSCI 104L with C-, plus 20 other completed courses of at most 2 units, stays in coursesRemaining and is not placed on the plan.

### 4. A printed C or C- floor is not applied, so a D or C- satisfies the requirement node.

Severity: high. Id: `grade-floor-missing`. Filed as #34.

The requirement node is satisfied for: computational-neuroscience-bs BISC 421 D; neuroscience-bs BISC 421 D; biological-sciences-ba BISC 120Lg D; applied-and-computational-mathematics-ba MATH 407 C-.

### 5. A list the page says may be substituted, or an honors pair, is scheduled as if it were required.

Severity: high. Id: `optional-required`. Already filed as #12 and #14.

Empty audits still list: computational-neuroscience-bs (BME 502, BME 575, CSCI 561, CSCI 662, EE 559, NSCI 524); neuroscience-bs (BME 575, NSCI 524, NSCI 531, NSCI 532, PSYC 506, PSYC 540).

### 6. A choose-one group, including a nested or inside a track, leaves more than one option on the remaining list.

Severity: high. Id: `choice-leak`. Computer Science is #37. Computational Neuroscience, Computer Engineering, and CSBA are #15, #16, and #17.

Empty remaining lists both sides for: computer-science-business-administration-bs (BUAD 312g, EE 364, MATH 225, MATH 407); computer-science-bs (MATH 235); computer-engineering-and-computer-science-bs (EE 141L, MATH 129).

### 7. Quantitative Biology asks for 6 units of research. QBIO 490x is stored as 1 unit, and the plan adds the honors courses QBIO 493 and QBIO 494, which the page requires only of honors students. The scheduled research is still short of 6 units.

Severity: high. Id: `research-units`. Filed as #36. The capstone pair is #20.

Empty plan courses include QBIO 499, QBIO 490x, QBIO 493, QBIO 494. Catalogue units for QBIO 490x are 1.

### 8. A later F is dropped because F rows do not count, so an earlier A still satisfies the course after a failed repeat.

Severity: medium. Id: `repeat-f`. Filed as #33.

A then F still satisfies the node for: applied-and-computational-mathematics-ba MATH 407.

### 9. An in-progress course with a printed floor is omitted from coursesRemaining and from the plan. On a tree with no stored floor the course is counted as done. On a tree with a floor the node stays open and another set hides the code.

Severity: medium. Id: `in-progress`. Filed as #35.

sample-mid-neuro BISC 220Lg is in progress. The requirement node is open: false. Remaining includes it: false. The plan places it: false. sample-early-cs CSCI 103L is in progress. The requirement node is open: true. Remaining includes it: false. The plan places it: false.

### 10. A course whose catalogue page does not print a term is stored as irregular and then placed in a specific fall or spring.

Severity: medium. Id: `unconfirmed-offering`. Already filed as #11.

Empty plans place an irregular course for: computer-science-business-administration-bs, law-and-regulation-of-artificial-intelligence-minor, computational-neuroscience-bs, neuroscience-bs, computer-science-bs, computer-engineering-and-computer-science-bs, cognitive-science-ba, artificial-intelligence-bs.

### 11. The grade sentence names a course code the course list does not print.

Severity: medium. Id: `grade-code-mismatch`. Already filed as #22, #23, and #24.

computer-science-business-administration-bs: CSCI 103, CSCI 104; computer-science-bs: CSCI 103, CSCI 104; computer-engineering-and-computer-science-bs: CSCI 103, CSCI 104

## Already filed

New issues from this check are #31 through #37. These observations were already open and are not filed again: #7, #8, #9, and #10 (a C- core disappears from coursesRemaining), #11 (a course with no printed term is placed in a semester), #12 and #14 (a graduate list the page says may be substituted is required), #15, #16, and #17 (one side of an or still leaves the other side remaining), #18 (neuroscience physics pairs missing from an empty audit), #19 (BISC 199 and NEUR 199 share a title), #20 (the quantitative biology capstone pair is not on the plan), and #22, #23, and #24 (the grade sentence names CSCI 103 and CSCI 104).

## Attacks that did not contradict the saved pages

BISC 199 and NEUR 199 share the title Neuroscience Colloquium. The saved course text does not say they are cross-listed. A computational neuroscience student with BISC 199 and an A still has NEUR 199 remaining. The engine has no cross-list field. That is an observation, not a counted failure.

The Artificial Intelligence Applications minor nested choice, CSCI 113x or the TAC 115/TAC 116 pair plus TAC 216, matches the mid fixture: TAC 115 is not remaining and TAC 216 is.

## Plan checker

The plan checker does not call the scheduler. It checks term order, the 18-unit recommended maximum, duplicate courses, parsed prerequisites, corequisites, printed offerings, zero-unit assumptions, and whether the planned courses cover the hand rule. A course with no printed term is a fault when the plan gives it a semester.

