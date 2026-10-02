import { Brand } from "@/components/ui/brand";
import { Icon } from "@/components/ui/icon";
import { SessionBar } from "@/components/auth/session-bar";
import { requirePageAccess } from "@/server/auth/page-access";
import { WorkspaceNav } from "@/components/navigation/workspace-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { company, membership } = await requirePageAccess(["company_admin", "billing"]);
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand href={membership.roles.includes("company_admin") ? "/admin/granskning" : "/admin/underlag"} />
        <div className="sidebar-heading">ARBETSYTA</div>
        <WorkspaceNav workspace="admin" canReview={membership.roles.includes("company_admin")} />
        <div className="sidebar-footer"><Icon name="check" /><p>Från utfört arbete<br />till granskat underlag.</p></div>
      </aside>
      <div className="admin-body">
        <SessionBar company={company.name} roles={membership.roles} workspace="admin" />
        <header className="admin-header"><span>Arbetsyta</span><span className="workspace-label">Administratör</span></header>
        <main id="huvudinnehall" className="admin-main" tabIndex={-1}>{children}</main>
        <footer className="admin-footer">Arbetsrapporter<span>Granska. Komplettera. Godkänn.</span></footer>
      </div>
    </div>
  );
}
