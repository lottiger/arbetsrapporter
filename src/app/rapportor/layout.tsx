import { Brand } from "@/components/ui/brand";
import { SessionBar } from "@/components/auth/session-bar";
import { requirePageAccess } from "@/server/auth/page-access";
import { WorkspaceNav } from "@/components/navigation/workspace-nav";

export default async function ReporterLayout({ children }: { children: React.ReactNode }) {
  const { company, membership } = await requirePageAccess(["reporter"]);
  return (
    <div className="reporter-shell">
      <SessionBar company={company.name} roles={membership.roles} workspace="reporter" />
      <header className="reporter-header">
        <Brand href="/rapportor" />
        <span className="workspace-label">Rapportör</span>
      </header>
      <main className="reporter-main" id="huvudinnehall" tabIndex={-1}>{children}</main>
      <WorkspaceNav workspace="reporter" />
    </div>
  );
}
