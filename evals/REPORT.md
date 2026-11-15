# Independent check

Tier 1 is the twelve programs with `selected: true` in `data/programs/index.json`. Neuroscience (BA) is stored and is not in this table. The rules were read from the saved 2026-2027 catalogue pages. `data/programs` was used only as the tree the engine audits. No person has set `humanChecked`. STARS remains the official audit.

Overall: 92 of 146 checks passed (63%).

## Accuracy

| Program | Checks | Passed | Accuracy | Invented courses | Choice leaks | Grade faults | Plan faults |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Computer Science/Business Administration (BS) | 16 | 9 | 56% | 0 | 1 | 0 | 7 |
| Law and Regulation of Artificial Intelligence Minor | 10 | 8 | 80% | 0 | 0 | 0 | 2 |
| Computational Neuroscience (BS) | 14 | 7 | 50% | 0 | 0 | 1 | 2 |
| Artificial Intelligence Applications Minor | 10 | 10 | 100% | 0 | 0 | 0 | 0 |
| Neuroscience (BS) | 11 | 5 | 45% | 0 | 1 | 1 | 2 |
| Computer Science (BS) | 17 | 9 | 53% | 0 | 1 | 0 | 5 |
| Quantitative Biology (BS) | 8 | 5 | 63% | 0 | 0 | 0 | 3 |
| Biological Sciences (BA) | 11 | 8 | 73% | 0 | 0 | 1 | 2 |
| Computer Engineering and Computer Science (BS) | 14 | 7 | 50% | 0 | 1 | 0 | 5 |
| Cognitive Science (BA) | 8 | 6 | 75% | 0 | 0 | 0 | 2 |
| Applied and Computational Mathematics (BA) | 13 | 9 | 69% | 0 | 0 | 1 | 1 |
| Artificial Intelligence (BS) | 14 | 9 | 64% | 0 | 0 | 0 | 5 |

## Synthetic STARS fixtures

The three records are `data/samples/students.json`, built from `fixtures/stars/early.txt`, `fixtures/stars/mid.txt`, and `fixtures/stars/late.txt`. A row fails when a hand-required code is missing, a forbidden code is still remaining, the remaining list invents an off-page course, or the remaining list does not cover the hand rule.

| Student | Program | Result | Must remain | Must not remain |
| --- | --- | --- | --- | --- |
| sample-late-csba | computer-science-business-administration-bs | pass | CSCI 201, CSCI 270, CSCI 310, CSCI 401, MATH 125g, ACCT 410x | none of the forbidden codes |
| sample-late-csba | law-and-regulation-of-artificial-intelligence-minor | pass | LAW 306 | none of the forbidden codes |
| sample-mid-neuro | computational-neuroscience-bs | fail | missing BISC 220Lg | TAC 116 |
| sample-mid-neuro | artificial-intelligence-applications-minor | pass | TAC 216, TAC 259, TAC 359, TAC 459 | none of the forbidden codes |
| sample-early-cs | computer-science-bs | pass | CSCI 103L, CSCI 104L, CSCI 170, CSCI 201, MATH 125g, WRIT 340, EE 109L | none of the forbidden codes |

## Defects

Ranked by how far a remaining list or a plan can move a student off the catalogue. Reproduce with `npm run hand-accuracy`.

### 1. A finished course below the printed floor is treated as already done by the planner, so the required repeat is not scheduled.

Severity: high. Id: `retake-not-planned`. Filed as #32.

computer-science-business-administration-bs: CSCI 102L with C- is still required and stays off the plan.

### 2. A printed C or C- floor is not applied, so a D or C- satisfies the requirement node.

Severity: high. Id: `grade-floor-missing`. Filed as #34.

The requirement node is satisfied for: computational-neuroscience-bs BISC 421 D; neuroscience-bs BISC 421 D; biological-sciences-ba BISC 120Lg D; applied-and-computational-mathematics-ba MATH 407 C-.

### 3. A choose-one group, including a nested or inside a track, leaves more than one option on the remaining list.

Severity: high. Id: `choice-leak`. Computer Science is #37. Computational Neuroscience, Computer Engineering, and CSBA are #15, #16, and #17.

Empty remaining lists both sides for: computer-science-business-administration-bs (BUAD 312g); neuroscience-bs (CHEM 115bL); computer-science-bs (MATH 235); computer-engineering-and-computer-science-bs (EE 141L).

### 4. Quantitative Biology asks for 6 units of research. QBIO 490x is stored as 1 unit, and the plan adds the honors courses QBIO 493 and QBIO 494, which the page requires only of honors students. The scheduled research is still short of 6 units.

Severity: high. Id: `research-units`. Filed as #36. The capstone pair is #20.

Empty plan courses include QBIO 499, QBIO 490x, QBIO 493, QBIO 494. Catalogue units for QBIO 490x are 1.

### 5. AP credit posted as TR does not satisfy a printed C floor, so a core the student already has stays open.

Severity: medium. Id: `transfer-ap`. 

An AP row with grade TR leaves the core node open for: computer-science-business-administration-bs CSCI 102L; computer-science-bs CSCI 102L; computer-engineering-and-computer-science-bs CSCI 102L; artificial-intelligence-bs CSCI 113x.

### 6. A later F is dropped because F rows do not count, so an earlier A still satisfies the course after a failed repeat.

Severity: medium. Id: `repeat-f`. Filed as #33.

A then F still satisfies the node for: computer-science-business-administration-bs CSCI 102L; computer-science-bs CSCI 102L; computer-engineering-and-computer-science-bs CSCI 102L; applied-and-computational-mathematics-ba MATH 407; artificial-intelligence-bs CSCI 113x.

### 7. An in-progress course with a printed floor is omitted from coursesRemaining and from the plan. On a tree with no stored floor the course is counted as done. On a tree with a floor the node stays open and another set hides the code.

Severity: medium. Id: `in-progress`. Filed as #35.

sample-mid-neuro BISC 220Lg is in progress. The requirement node is open: false. Remaining includes it: false. The plan places it: false. sample-early-cs CSCI 103L is in progress. The requirement node is open: true. Remaining includes it: true. The plan places it: false.

### 8. The grade sentence names a course code the course list does not print.

Severity: medium. Id: `grade-code-mismatch`. Already filed as #22, #23, and #24.

computer-science-business-administration-bs: CSCI 103, CSCI 104; computer-science-bs: CSCI 103, CSCI 104; computer-engineering-and-computer-science-bs: CSCI 103, CSCI 104

## Already filed

New issues from this check are #31 through #37. These observations were already open and are not filed again: #7, #8, #9, and #10 (a C- core disappears from coursesRemaining), #11 (a course with no printed term is placed in a semester), #12 and #14 (a graduate list the page says may be substituted is required), #15, #16, and #17 (one side of an or still leaves the other side remaining), #18 (neuroscience physics pairs missing from an empty audit), #19 (BISC 199 and NEUR 199 share a title), #20 (the quantitative biology capstone pair is not on the plan), and #22, #23, and #24 (the grade sentence names CSCI 103 and CSCI 104).

## Attacks that did not contradict the saved pages

BISC 199 and NEUR 199 share the title Neuroscience Colloquium. The saved course text does not say they are cross-listed. A computational neuroscience student with BISC 199 and an A still has NEUR 199 remaining. The engine has no cross-list field. That is an observation, not a counted failure.

The Artificial Intelligence Applications minor nested choice, CSCI 113x or the TAC 115/TAC 116 pair plus TAC 216, matches the mid fixture: TAC 115 is not remaining and TAC 216 is.

## Plan checker

The plan checker does not call the scheduler. It checks term order, the 18-unit recommended maximum, duplicate courses, parsed prerequisites, corequisites, printed offerings, zero-unit assumptions, and whether the planned courses cover the hand rule. A course with no printed term is a fault when the plan gives it a semester.

