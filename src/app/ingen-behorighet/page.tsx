import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default function AccessDeniedPage() {
  return (
    <main id="huvudinnehall" tabIndex={-1} className="not-found">
      <p className="eyebrow">ÅTKOMST SAKNAS</p><h1>Du har inte åtkomst till den här sidan</h1>
      <p>Välj ett företag där du har ett aktivt medlemskap, eller kontakta administratören om din behörighet behöver ändras.</p>
      <Link className="button-primary" href="/foretag">Välj företag</Link><SignOutButton />
    </main>
  );
}
