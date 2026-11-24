import { publicPageMetadata } from "@/lib/seo";
import { DemoDashboard } from "@/components/demo-dashboard";

export const metadata = publicPageMetadata("/demo", "Interactive family loan demo", "Explore a sample family loan ledger. Try parent and child views, review payment history, and see how balances and interest are tracked.");

export default function DemoPage() {
  return <DemoDashboard />;
}
