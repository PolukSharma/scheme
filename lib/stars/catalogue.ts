import coursesJson from "@/data/courses.json";
import type { Course } from "@/lib/types";

const courses = coursesJson as Course[];

const byCode = new Map(courses.map((course) => [course.code, course]));

export function findCatalogueCourse(code: string): Course | null {
  return byCode.get(code) ?? null;
}

export function searchCatalogue(query: string, limit = 8): Course[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const matches: Course[] = [];
  for (const course of courses) {
    if (course.code.toLowerCase().includes(needle) || course.title.toLowerCase().includes(needle)) {
      matches.push(course);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
