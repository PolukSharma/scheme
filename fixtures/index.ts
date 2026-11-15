import careerMatchJson from "./career-match.json";
import chatAnswerJson from "./chat-answer.json";
import coursesJson from "./courses.json";
import policyRulesJson from "./policy-rules.json";
import programsJson from "./programs.json";
import studentsJson from "./students.json";
import stubResultsJson from "./stub-results.json";
import transferRulesJson from "./transfer-rules.json";
import {
  careerMatchSchema,
  chatAnswerSchema,
  courseListSchema,
  parseWith,
  policyRuleListSchema,
  programListSchema,
  stubResultsSchema,
  studentListSchema,
  transferRuleListSchema,
} from "@/lib/types";

export const courses = parseWith(courseListSchema, coursesJson, "fixtures/courses.json");
export const programs = parseWith(programListSchema, programsJson, "fixtures/programs.json");
export const students = parseWith(studentListSchema, studentsJson, "fixtures/students.json");
export const policyRules = parseWith(
  policyRuleListSchema,
  policyRulesJson,
  "fixtures/policy-rules.json",
);
export const transferRules = parseWith(
  transferRuleListSchema,
  transferRulesJson,
  "fixtures/transfer-rules.json",
);
export const careerMatch = parseWith(
  careerMatchSchema,
  careerMatchJson,
  "fixtures/career-match.json",
);
export const chatAnswer = parseWith(chatAnswerSchema, chatAnswerJson, "fixtures/chat-answer.json");
export const stubResults = parseWith(
  stubResultsSchema,
  stubResultsJson,
  "fixtures/stub-results.json",
);
