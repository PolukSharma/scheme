# Accuracy

Golden trees were read from the saved catalogue HTML in data/raw/2026-2027. data/programs was opened only after those trees were built. A disagreement is listed and not resolved.

No person has checked these rows by hand. Verified stays no until that happens. STARS remains the official audit.

Audit cases 60/65. Plans 17/18. Trees that differ: 0. Defects: 12.

| Program | Tree matches golden | Audits | Plans valid | Verified | Checked by hand |
| --- | --- | --- | --- | --- | --- |
| AI Applications (as a specialization of the CSBA major) | no page | 0/0 | 0/0 | no | not checked by a person |
| Computer Science/Business Administration (BS) | yes | 5/6 | 2/2 | no | not checked by a person |
| Law and Regulation of Artificial Intelligence Minor | yes | 5/5 | 2/2 | no | not checked by a person |
| Computational Neuroscience (BS) | yes | 4/5 | 2/2 | no | not checked by a person |
| Artificial Intelligence Applications Minor | yes | 5/5 | 2/2 | no | not checked by a person |
| Neuroscience (BS) | yes | 4/5 | 1/1 | no | not checked by a person |
| Neuroscience (BA) | yes | 4/5 | 1/1 | no | not checked by a person |
| Computer Science (BS) | yes | 6/6 | 2/2 | no | not checked by a person |
| Quantitative Biology (BS) | yes | 5/5 | 0/1 | no | not checked by a person |
| Biological Sciences (BA) | yes | 5/5 | 1/1 | no | not checked by a person |
| Computer Engineering and Computer Science (BS) | yes | 5/6 | 1/1 | no | not checked by a person |
| Cognitive Science (BA) | yes | 1/1 | 1/1 | no | not checked by a person |
| Applied and Computational Mathematics (BA) | yes | 5/5 | 1/1 | no | not checked by a person |
| Artificial Intelligence (BS) | yes | 6/6 | 1/1 | no | not checked by a person |
| Career goals | no labelled set | 0/0 | not run | no | not checked by a person |
| Guard and promises | n/a | 4/4 | n/a | no | not checked by a person |

## Defects

Ranked by how badly they would mislead a demo. Each one names the catalogue sentence or the page, and does not pick a winner when the page and the tree disagree.

### 1. Computational Neuroscience (BS): one-side-of-each-or does not match the catalogue page

Severity: medium. Owner: `lib/engine`.

After taking BISC 220Lg, CHEM 103Lgx, PHYS 135aLg, PHYS 135bL, HP 340Lg, BISC 444, BISC 423, CSCI 170, these alternatives are still remaining: TAC 115, TAC 116, MEDS 330, MEDS 340. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31871

### 2. Computer Engineering and Computer Science (BS): one-side-of-each-or does not match the catalogue page

Severity: medium. Owner: `lib/engine`.

After taking MATH 126g, MATH 225, MATH 226g, PHYS 151Lg, PHYS 152L, CSCI 360, these alternatives are still remaining: MATH 129, EE 141L, PHYS 161Lg, PHYS 162L. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=32083

### 3. Computer Science/Business Administration (BS): one-side-of-each-or does not match the catalogue page

Severity: medium. Owner: `lib/engine`.

After taking MATH 126g, BISC 120Lg, BUAD 310g, EE 141L, BUAD 311, these alternatives are still remaining: BUAD 312g. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=32088

### 4. Neuroscience (BA): one-side-of-each-or does not match the catalogue page

Severity: medium. Owner: `lib/engine`.

After taking BISC 220Lg, CHEM 103Lgx, BUAD 310g, these alternatives are still remaining: CHEM 105aLg, PSYC 274Lg. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31869

### 5. Neuroscience (BS): empty does not match the catalogue page

Severity: medium. Owner: `lib/engine`.

None of PHYS 135aLg, PHYS 151Lg is in coursesRemaining. None of PHYS 135bL, PHYS 152L is in coursesRemaining. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31870

### 6. Two catalogue courses share a title and the engine treats them as different

Severity: medium. Owner: `data/courses.json`.

BISC 199 and NEUR 199 share the title "Neuroscience Colloquium" and the same unit count. Neither stored course sentence says they are cross-listed. A student who completed BISC 199 still has NEUR 199 remaining: true. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31871

### 7. Quantitative Biology (BS): a plan for near-quantitative-biology-bs fails the validity checker

Severity: medium. Owner: `lib/engine`.

None of QBIO 481, QBIO 482 is done or on the plan. The page requires one of them.

### 8. The 20 labelled career goals are not in the repo

Severity: low. Owner: `evals/career`.

evals/career/ is absent, so the career-goal accuracy check was not run.

### 9. Computer Engineering and Computer Science (BS): a grade sentence names a code the course list does not print

Severity: low. Owner: `data/programs`.

A grade of C (2.0) or better is required for each of the core courses CSCI 102L , CSCI 103 , CSCI 170 , CSCI 104 and CSCI 201 . The course list does not contain CSCI 103, CSCI 104.

### 10. Computer Science (BS): a grade sentence names a code the course list does not print

Severity: low. Owner: `data/programs`.

A grade of C (2.0) or better is required for each of the core courses CSCI 102L , CSCI 103 , CSCI 170 , CSCI 104 and CSCI 201 . The course list does not contain CSCI 103, CSCI 104.

### 11. Computer Science/Business Administration (BS): a grade sentence names a code the course list does not print

Severity: low. Owner: `data/programs`.

A grade of C (2.0) or better is required for each of the core courses CSCI 102L , CSCI 103 , CSCI 170 , CSCI 104 and CSCI 201 . The course list does not contain CSCI 103, CSCI 104.

### 12. AI Applications as a CSBA specialization has no catalogue page

Severity: low. Owner: `data/programs`.

No specialization by this name is in the program index. The Artificial Intelligence Applications minor is a different program and is not used in its place.

