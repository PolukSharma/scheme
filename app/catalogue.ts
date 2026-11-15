import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sampleStudents } from "@/data/samples";
import {
  courseSchema,
  policyRuleSchema,
  programSchema,
  transferRuleSchema,
  type Course,
  type PolicyRule,
  type Program,
  type StudentRecord,
  type TransferRule,
} from "@/lib/types";

export interface Catalogue {
  programs: Program[];
  courses: Course[];
  policyRules: PolicyRule[];
  transferRules: TransferRule[];
  samples: StudentRecord[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export function loadCatalogue(): Catalogue {
  const root = join(process.cwd(), "data");
  const programs = readdirSync(join(root, "programs"))
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .sort()
    .map((name) => {
      const parsed = programSchema.safeParse(readJson(join(root, "programs", name)));
      if (!parsed.success) {
        throw new Error(`Program file ${name} does not match the shared program type.`);
      }
      return parsed.data;
    });
  const courses = courseSchema.array().safeParse(readJson(join(root, "courses.json")));
  if (!courses.success) throw new Error("data/courses.json does not match the shared course type.");
  const policyRules = policyRuleSchema.array().safeParse(readJson(join(root, "policy-rules.json")));
  if (!policyRules.success) throw new Error("data/policy-rules.json does not match the shared policy type.");
  const transferRules = transferRuleSchema.array().safeParse(readJson(join(root, "transfer-rules.json")));
  if (!transferRules.success) throw new Error("data/transfer-rules.json does not match the shared transfer type.");
  return {
    programs,
    courses: courses.data,
    policyRules: policyRules.data,
    transferRules: transferRules.data,
    samples: [...sampleStudents],
  };
}
