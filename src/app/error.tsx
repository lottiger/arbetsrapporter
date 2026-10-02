"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="huvudinnehall" tabIndex={-1} className="not-found" role="alert">
      <h1>Sidan kunde inte laddas</h1><p>Vi kunde inte kontrollera din åtkomst eller hämta uppgifterna. Försök igen om en stund.</p>
      <button type="button" onClick={reset} className="button-primary">Försök igen</button><br />
      <Link href="/logga-in" className="back-link">Till inloggningen</Link>
    </main>
  );
}
