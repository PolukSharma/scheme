import { studentRecordSchema, type StudentCourse, type StudentRecord } from "@/lib/types";

/** Every intake path builds the record through this check. */
export function createStudentRecord(record: StudentRecord): StudentRecord {
  return studentRecordSchema.parse(record);
}

export function sameRecord(left: StudentRecord, right: StudentRecord): boolean {
  return JSON.stringify(createStudentRecord(left)) === JSON.stringify(createStudentRecord(right));
}

export type { StudentCourse };
