import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { ScreenHeader } from "@/components/screen-header";

export default function AccuracyPage() {
  const path = join(process.cwd(), "evals", "accuracy.json");
  const table = existsSync(path) ? readAccuracy(path) : null;
  return (
    <main className="wrap" id="content">
      <ScreenHeader title="accuracy" />
      {table ? (
        <table>
          <caption>Accuracy figures written by Verification.</caption>
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.join("|")}>
                {row.map((cell, index) => (
                  <td key={`${table.columns[index] ?? "cell"}-${cell}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="banner" role="status">
          Verification has not written evals/accuracy.json yet. This page will show that file when it is there.
        </p>
      )}
      <p>
        <Link href="/">Back to Scheme</Link>
      </p>
    </main>
  );
}

function readAccuracy(path: string): { columns: string[]; rows: string[][] } | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const records = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)
        ? (parsed as { rows: unknown[] }).rows
        : null;
    if (!records || records.length === 0) return { columns: ["Value"], rows: [[JSON.stringify(parsed)]] };
    const objects = records.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
    if (objects.length === 0) return { columns: ["Value"], rows: records.map((row) => [JSON.stringify(row)]) };
    const columns = Object.keys(objects[0] ?? {});
    return {
      columns,
      rows: objects.map((row) => columns.map((column) => String(row[column] ?? ""))),
    };
  } catch {
    return null;
  }
}
