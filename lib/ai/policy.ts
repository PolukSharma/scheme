const outside =
  /\b(salary|salaries|wage|wages|tuition|hiring|hired|placement)\b|\badmission\b|\bchances?\b|\bget in\b|\bgrade(?:s)? (?:do i|needed|required)\b|ignore (?:your |the |all )?(?:previous |prior )?(?:instructions|rules|catalogue|catalog)/i;

/** The question is data. These topics are declined before a model sees them. */
export function isOutsideQuestion(question: string): boolean {
  return outside.test(question);
}

const courseCode = /\b[A-Z]{2,8} \d{3}[A-Za-z]{0,4}\b/g;

export function unknownCourseCode(question: string, known: ReadonlySet<string>): string | null {
  const found = question.match(courseCode) ?? [];
  return found.find((code) => !known.has(code)) ?? null;
}
