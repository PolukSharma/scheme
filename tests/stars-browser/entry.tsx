import { useState } from "react";
import { createRoot } from "react-dom/client";
import { StarsDropZone } from "@/components/intake/drop-zone";
import type { StudentRecord } from "@/lib/types";

function Harness() {
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [generation, setGeneration] = useState(0);

  return (
    <div>
      <StarsDropZone
        onRecord={(next) => {
          setRecord(next);
          setGeneration((value) => value + 1);
        }}
        onManualEntry={() => {
          const note = document.getElementById("stars-manual");
          if (note) note.textContent = "manual";
        }}
      />
      <pre id="stars-result" data-generation={generation}>
        {record ? `${record.majorId} ${record.courses.length}` : ""}
      </pre>
      <p id="stars-manual"></p>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing root");
createRoot(root).render(<Harness />);
