import studentsJson from "./students.json";
import { studentListSchema, type StudentRecord } from "@/lib/types";

export const sampleStudents: readonly StudentRecord[] = studentListSchema.parse(studentsJson);
