# Accuracy

Golden trees were read from the saved catalogue HTML in data/raw/2026-2027. data/programs was opened only after those trees were built. A disagreement is listed and not resolved.

No person has checked these rows by hand. Verified stays no until that happens. STARS remains the official audit.

Audit cases 57/65. Plans 8/18. Trees that differ: 3. Defects: 19.

| Program | Tree matches golden | Audits | Plans valid | Verified | Checked by hand |
| --- | --- | --- | --- | --- | --- |
| AI Applications (as a specialization of the CSBA major) | no page | 0/0 | 0/0 | no | not checked by a person |
| Computer Science/Business Administration (BS) | yes | 4/6 | 1/2 | no | not checked by a person |
| Law and Regulation of Artificial Intelligence Minor | yes | 5/5 | 1/2 | no | not checked by a person |
| Computational Neuroscience (BS) | no | 4/5 | 0/2 | no | not checked by a person |
| Artificial Intelligence Applications Minor | yes | 5/5 | 1/2 | no | not checked by a person |
| Neuroscience (BS) | no | 4/5 | 0/1 | no | not checked by a person |
| Neuroscience (BA) | no | 5/5 | 0/1 | no | not checked by a person |
| Computer Science (BS) | yes | 5/6 | 1/2 | no | not checked by a person |
| Quantitative Biology (BS) | yes | 5/5 | 0/1 | no | not checked by a person |
| Biological Sciences (BA) | yes | 5/5 | 1/1 | no | not checked by a person |
| Computer Engineering and Computer Science (BS) | yes | 4/6 | 1/1 | no | not checked by a person |
| Cognitive Science (BA) | yes | 1/1 | 0/1 | no | not checked by a person |
| Applied and Computational Mathematics (BA) | yes | 5/5 | 1/1 | no | not checked by a person |
| Artificial Intelligence (BS) | yes | 5/6 | 1/1 | no | not checked by a person |
| Career goals | no labelled set | 0/0 | not run | no | not checked by a person |
| Guard and promises | n/a | 4/4 | n/a | no | not checked by a person |

## Defects

Ranked by how badly they would mislead a demo. Each one names the catalogue sentence or the page, and does not pick a winner when the page and the tree disagree.

### 1. Artificial Intelligence (BS): grade-below-c does not match the catalogue page

Severity: high. Owner: `lib/engine`.

A grade of C (2.0) or better is required for each of the core courses CSCI 113x , CSCI 114x , CSCI 170 , and the Mathematical Foundations courses. CSCI 113x with C- is not in coursesRemaining. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=32917

### 2. Computer Engineering and Computer Science (BS): grade-below-c does not match the catalogue page

Severity: high. Owner: `lib/engine`.

A grade of C (2.0) or better is required for each of the core courses CSCI 102L , CSCI 103 , CSCI 170 , CSCI 104 and CSCI 201 . CSCI 102L with C- is not in coursesRemaining. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=32083

### 3. Computer Science (BS): grade-below-c does not match the catalogue page

Severity: high. Owner: `lib/engine`.

A grade of C (2.0) or better is required for each of the core courses CSCI 102L , CSCI 103 , CSCI 170 , CSCI 104 and CSCI 201 . CSCI 102L with C- is not in coursesRemaining. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=32086

### 4. Computer Science/Business Administration (BS): grade-below-c does not match the catalogue page

Severity: high. Owner: `lib/engine`.

A grade of C (2.0) or better is required for each of the core courses CSCI 102L , CSCI 103 , CSCI 170 , CSCI 104 and CSCI 201 . CSCI 102L with C- is not in coursesRemaining. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=32088

### 5. Plans place courses whose catalogue page does not print a term

Severity: high. Owner: `lib/engine`.

The stored course sentence says the term is not printed, and the offering list is irregular. The plan still puts the course in a fall, spring, or summer term. Courses: CSCI 662, PSYC 506, PSYC 544, PSYC 545, PSYC 547, PSYC 551, PSYC 301L, ECON 405, HBIO 200Lg, HBIO 308, CSCI 350, EE 141L.
CSCI 662 is placed in Spring 2027. The course page lists irregular. No typical term is printed.
PSYC 506 is placed in Fall 2027. The course page lists irregular. No typical term is printed.
PSYC 544 is placed in Fall 2027. The course page lists irregular. No typical term is printed.
PSYC 545 is placed in Spring 2028. The course page lists irregular. No typical term is printed.
PSYC 547 is placed in Spring 2028. The course page lists irregular. No typical term is printed.
PSYC 551 is placed in Spring 2028. The course page lists irregular. No typical term is printed.
PSYC 506 is placed in Spring 2027. The course page lists irregular. No typical term is printed.
PSYC 545 is placed in Fall 2027. The course page lists irregular. No typical term is printed.

### 6. Computational Neuroscience (BS): the tree requires a list the page says may be substituted

Severity: high. Owner: `data/programs`.

Graduate Courses A graduate class from the following list may be substituted for an undergraduate computational course with the permission of the co-directors and instructor and with a minimum GPA of 3.3. The extracted tree puts these courses in an all-of list: BME 502, BME 575, CSCI 561, CSCI 662, EE 559, NSCI 524, NSCI 531, NSCI 532, PSYC 506, PSYC 540, PSYC 544, PSYC 545, PSYC 547, PSYC 551, PSYC 555. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31871

### 7. Neuroscience (BA): the tree requires a list the page says may be substituted

Severity: high. Owner: `data/programs`.

Graduate Courses A graduate class from the following list may be substituted for an upper-division elective with the permission of the co-directors and instructor and with a minimum GPA of 3.3. The extracted tree puts these courses in an all-of list: BME 575, NSCI 524, NSCI 531, NSCI 532, PSYC 506, PSYC 540, PSYC 544, PSYC 545, PSYC 547, PSYC 551, PSYC 555. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31869

### 8. Neuroscience (BS): the tree requires a list the page says may be substituted

Severity: high. Owner: `data/programs`.

Graduate Courses A graduate class from the following list may be substituted for an upper-division elective with the permission of the co-directors and instructor and with a minimum GPA of 3.3. The extracted tree puts these courses in an all-of list: BME 575, NSCI 524, NSCI 531, NSCI 532, PSYC 506, PSYC 540, PSYC 544, PSYC 545, PSYC 547, PSYC 551, PSYC 555. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31870

### 9. Computational Neuroscience (BS): one-side-of-each-or does not match the catalogue page

Severity: medium. Owner: `lib/engine`.

After taking BISC 220Lg, CHEM 103Lgx, PHYS 135aLg, PHYS 135bL, HP 340Lg, BISC 444, BISC 423, CSCI 170, these alternatives are still remaining: TAC 115, TAC 116, MEDS 330, MEDS 340. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31871

### 10. Computer Engineering and Computer Science (BS): one-side-of-each-or does not match the catalogue page

Severity: medium. Owner: `lib/engine`.

After taking MATH 126g, MATH 225, MATH 226g, PHYS 151Lg, PHYS 152L, CSCI 360, these alternatives are still remaining: MATH 129, EE 141L, PHYS 161Lg, PHYS 162L. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=32083

### 11. Computer Science/Business Administration (BS): one-side-of-each-or does not match the catalogue page

Severity: medium. Owner: `lib/engine`.

After taking MATH 126g, BISC 120Lg, BUAD 310g, EE 141L, BUAD 311, these alternatives are still remaining: BUAD 312g. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=32088

### 12. Neuroscience (BS): empty does not match the catalogue page

Severity: medium. Owner: `lib/engine`.

None of PHYS 135aLg, PHYS 151Lg is in coursesRemaining. None of PHYS 135bL, PHYS 152L is in coursesRemaining. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31870

### 13. Two catalogue courses share a title and the engine treats them as different

Severity: medium. Owner: `data/courses.json`.

BISC 199 and NEUR 199 share the title "Neuroscience Colloquium" and the same unit count. Neither stored course sentence says they are cross-listed. A student who completed BISC 199 still has NEUR 199 remaining: true. Page: https://catalogue.usc.edu/preview_program.php?catoid=22&poid=31871

### 14. Quantitative Biology (BS): a plan for near-quantitative-biology-bs fails the validity checker

Severity: medium. Owner: `lib/engine`.

None of QBIO 481, QBIO 482 is done or on the plan. The page requires one of them.

### 15. The 20 labelled career goals are not in the repo

Severity: low. Owner: `evals/career`.

evals/career/ is absent, so the career-goal accuracy check was not run.

### 16. Computer Engineering and Computer Science (BS): a grade sentence names a code the course list does not print

Severity: low. Owner: `data/programs`.

A grade of C (2.0) or better is required for each of the core courses CSCI 102L , CSCI 103 , CSCI 170 , CSCI 104 and CSCI 201 . The course list does not contain CSCI 103, CSCI 104.

### 17. Computer Science (BS): a grade sentence names a code the course list does not print

Severity: low. Owner: `data/programs`.

A grade of C (2.0) or better is required for each of the core courses CSCI 102L , CSCI 103 , CSCI 170 , CSCI 104 and CSCI 201 . The course list does not contain CSCI 103, CSCI 104.

### 18. Computer Science/Business Administration (BS): a grade sentence names a code the course list does not print

Severity: low. Owner: `data/programs`.

A grade of C (2.0) or better is required for each of the core courses CSCI 102L , CSCI 103 , CSCI 170 , CSCI 104 and CSCI 201 . The course list does not contain CSCI 103, CSCI 104.

### 19. AI Applications as a CSBA specialization has no catalogue page

Severity: low. Owner: `data/programs`.

No specialization by this name is in the program index. The Artificial Intelligence Applications minor is a different program and is not used in its place.

