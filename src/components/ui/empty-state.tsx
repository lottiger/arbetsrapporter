import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export function EmptyState({ icon = "inbox", title, children }: { icon?: IconName; title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} /></span>
      <h2>{title}</h2>
      <div className="empty-description">{children}</div>
    </div>
  );
}
