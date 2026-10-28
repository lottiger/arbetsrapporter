import type { Metadata } from "next";
import { OfflineWorkspace } from "@/components/reports/offline-workspace";

export const metadata: Metadata = { title: "Lokala utkast" };
// Public shell only: no session, company, report or other private server data.
export default function OfflinePage() {
  return <div className="reporter-shell"><main className="reporter-main" id="huvudinnehall"><OfflineWorkspace /></main></div>;
}
