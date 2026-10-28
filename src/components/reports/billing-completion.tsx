"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportDetail } from "@/domain/reports";
import { reportTime } from "./report-list";
import { Icon } from "@/components/ui/icon";

export function BillingCompletion({ organizationId, reportId, revision, versionId, handled }: {
  organizationId: string; reportId: string; revision: number; versionId: string; handled: ReportDetail["billingHandled"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false);

  async function save() {
    if (pending.current || handled || conflict) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/foretag/${encodeURIComponent(organizationId)}/rapporter/${encodeURIComponent(reportId)}/klarmarkera`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, versionId, confirmed: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "Markeringen kunde inte sparas."); setConflict(response.status === 409); return;
      }
      router.refresh();
    } catch {
      setMessage("Kunde inte bekräfta sparandet. Kontrollera anslutningen och försök igen.");
    } finally { pending.current = false; setBusy(false); }
  }

  return <div className="billing-completion" aria-busy={busy}>
    {handled ? <div className="billing-done" role="status"><strong><Icon name="check" />Inlagd / helt klar</strong>
      <span>{handled.actorName} · {reportTime(handled.at)}</span>
    </div> : <div className="form-actions">
      <button type="button" className="button-primary" disabled={busy || conflict} onClick={() => void save()}><Icon name="check" />{busy ? "Sparar…" : "Markera som inlagd"}</button>
    </div>}
    {message && <p className="form-error" role="alert">{message}</p>}
    {conflict && <button type="button" className="text-button" onClick={() => router.refresh()}>Öppna den senaste rapporten</button>}
  </div>;
}
