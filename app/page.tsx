import { loadCatalogue } from "@/app/catalogue";
import { Planner } from "@/components/planner";

export default function Page() {
  const catalogue = loadCatalogue();
  return <Planner catalogue={catalogue} />;
}
