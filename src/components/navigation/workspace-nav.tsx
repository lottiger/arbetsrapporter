"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";

const items: Record<"reporter" | "admin", { href: string; label: string; icon: IconName }[]> = {
  reporter: [
    { href: "/rapportor", label: "Hem", icon: "home" },
    { href: "/rapportor/ny", label: "Ny rapport", icon: "plus" },
    { href: "/rapportor/rapporter", label: "Mina rapporter", icon: "report" },
  ],
  admin: [
    { href: "/admin/granskning", label: "Granskning", icon: "inbox" },
    { href: "/admin/underlag", label: "Faktureringsunderlag", icon: "layers" },
    { href: "/admin/mallar", label: "Mallar", icon: "template" },
    { href: "/admin/foretag", label: "Företagsuppgifter", icon: "home" },
  ],
};

export function WorkspaceNav({ workspace, canReview = true }: { workspace: keyof typeof items; canReview?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={`workspace-nav ${workspace}-nav`} aria-label={workspace === "reporter" ? "Rapportörens navigation" : "Administratörens navigation"}>
      {items[workspace].filter((item) => workspace !== "admin" || canReview || item.href === "/admin/underlag").map(({ href, label, icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          <Icon name={icon} /><span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
