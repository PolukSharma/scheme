/**
 * The programs Verification reads. Names and page addresses come from the
 * program index. This file does not read a requirement tree.
 */

export interface CataloguePage {
  id: string;
  name: string;
  school: string;
  kind: "major" | "minor";
  poid: string;
  url: string;
}

const year = "2026-2027";

function page(id: string, name: string, school: string, kind: "major" | "minor", poid: string): CataloguePage {
  return {
    id,
    name,
    school,
    kind,
    poid,
    url: `https://catalogue.usc.edu/preview_program.php?catoid=22&poid=${poid}`,
  };
}

export const catalogueYear = year;

export const cataloguePages: readonly CataloguePage[] = [
  page(
    "computer-science-business-administration-bs",
    "Computer Science/Business Administration (BS)",
    "USC Viterbi School of Engineering",
    "major",
    "32088",
  ),
  page(
    "law-and-regulation-of-artificial-intelligence-minor",
    "Law and Regulation of Artificial Intelligence Minor",
    "USC Gould School of Law",
    "minor",
    "32878",
  ),
  page(
    "computational-neuroscience-bs",
    "Computational Neuroscience (BS)",
    "USC Dornsife College of Letters, Arts and Sciences",
    "major",
    "31871",
  ),
  page(
    "artificial-intelligence-applications-minor",
    "Artificial Intelligence Applications Minor",
    "USC Viterbi School of Engineering",
    "minor",
    "32792",
  ),
  page("neuroscience-bs", "Neuroscience (BS)", "USC Dornsife College of Letters, Arts and Sciences", "major", "31870"),
  page("neuroscience-ba", "Neuroscience (BA)", "USC Dornsife College of Letters, Arts and Sciences", "major", "31869"),
  page("computer-science-bs", "Computer Science (BS)", "USC Viterbi School of Engineering", "major", "32086"),
  page(
    "quantitative-biology-bs",
    "Quantitative Biology (BS)",
    "USC Dornsife College of Letters, Arts and Sciences",
    "major",
    "32504",
  ),
  page(
    "biological-sciences-ba",
    "Biological Sciences (BA)",
    "USC Dornsife College of Letters, Arts and Sciences",
    "major",
    "31717",
  ),
  page(
    "computer-engineering-and-computer-science-bs",
    "Computer Engineering and Computer Science (BS)",
    "USC Viterbi School of Engineering",
    "major",
    "32083",
  ),
  page("cognitive-science-ba", "Cognitive Science (BA)", "USC Dornsife College of Letters, Arts and Sciences", "major", "31909"),
  page(
    "applied-and-computational-mathematics-ba",
    "Applied and Computational Mathematics (BA)",
    "USC Dornsife College of Letters, Arts and Sciences",
    "major",
    "31854",
  ),
  page("artificial-intelligence-bs", "Artificial Intelligence (BS)", "USC Viterbi School of Engineering", "major", "32917"),
];

export const notFoundAsNamed = {
  id: "ai-applications-as-a-specialization-of-the-csba-major",
  requestedName: "AI Applications (as a specialization of the CSBA major)",
  note: "No specialization by this name is in the program index. The Artificial Intelligence Applications minor is a different program and is not used in its place.",
};
