import Link from "next/link";

export default function NotFound() {
  return (
    <main id="huvudinnehall" tabIndex={-1} className="not-found">
      <p className="eyebrow">404 · SIDAN SAKNAS</p><h1>Här fanns ingen sida</h1><p>Kontrollera adressen eller gå tillbaka till din översikt.</p><Link href="/rapportor" className="button-primary">Till översikten</Link>
    </main>
  );
}
