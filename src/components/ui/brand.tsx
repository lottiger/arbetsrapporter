import Link from "next/link";
import { Icon } from "./icon";

export function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="brand" aria-label="Arbetsrapporter – startsida">
      <span className="brand-mark"><Icon name="report" /></span>
      <span>Arbetsrapporter<span className="brand-dot">.</span></span>
    </Link>
  );
}
