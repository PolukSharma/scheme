import { Wordmark } from "@/components/wordmark";
import { courseSchema, programSchema, studentRecordSchema } from "@/contracts";
import courses from "@/evals/fixtures/courses.json";
import programs from "@/evals/fixtures/programs.json";
import students from "@/evals/fixtures/students.json";

const loadedCourses = courses.map((course) => courseSchema.parse(course));
const loadedPrograms = programs.map((program) => programSchema.parse(program));
const loadedStudents = students.map((student) => studentRecordSchema.parse(student));

export default function Page() {
  return (
    <div className="frame">
      <header>
        <h1>
          <Wordmark />
        </h1>
        <p>Unofficial student project, not affiliated with USC.</p>
      </header>
      <main>
        <section className="card">
          <p>
            {loadedCourses.length} synthetic courses, {loadedPrograms.length} synthetic
            programs, and {loadedStudents.length} synthetic students. None of these rows
            are catalogue requirements.
          </p>
          <ul>
            {loadedPrograms.map((program) => (
              <li key={program.id}>
                {program.name} · {program.school} · {program.catalogueYear} ·{" "}
                {program.verified ? "verified" : "unverified"}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer>
        <p>
          STARS is the official audit. <Wordmark /> is a planning aid.
        </p>
      </footer>
    </div>
  );
}
