import { HomePlanner } from "@/components/home-planner";
import { buildSampleViews } from "@/lib/sample-views";

export default function Page() {
  const views = buildSampleViews();
  return <HomePlanner views={views} />;
}
