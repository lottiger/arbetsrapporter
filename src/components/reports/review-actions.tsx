"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({ organizationId, reportId, revision, versionId }: {
  organizationId: string; reportId: string; revision: number; versionId: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState<"approve" | "request_completion" | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false);

  async function decide() {
    if (!action || pending.current || conflict) return;
    if (action === "request_completion" && !comment.trim()) {
      setMessage("Skriv vad som behöver kompletteras."); return;
    }
    pending.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/foretag/${encodeURIComponent(organizationId)}/rapporter/${encodeURIComponent(reportId)}/granska`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, revision, versionId, ...(action === "request_completion" ? { comment: comment.trim() } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "Beslutet kunde inte sparas."); setConflict(response.status === 409); return;
      }
      router.refresh();
    } catch {
      setMessage("Kunde inte bekräfta beslutet. Kommentaren finns kvar här. Kontrollera anslutningen och försök igen.");
    } finally { pending.current = false; setBusy(false); }
  }

  return <section className="form-section review-actions" aria-labelledby="review-title" aria-busy={busy}>
    <h2 id="review-title">Granska rapporten</h2>
    <p>Godkänn rapporten eller beskriv vad rapportören behöver komplettera.</p>
    {!action ? <div className="form-actions">
      <button type="button" className="button-primary" onClick={() => setAction("approve")}>Godkänn rapport</button>
      <button type="button" className="button-secondary" onClick={() => setAction("request_completion")}>Begär komplettering</button>
    </div> : <form onSubmit={(event) => { event.preventDefault(); void decide(); }} noValidate>
      {action === "request_completion" ? <div className="field">
        <label htmlFor="completion-comment">Vad behöver kompletteras?</label>
        <textarea id="completion-comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={2000} required disabled={busy} aria-describedby="completion-help" />
        <span id="completion-help" className="field-hint">Kommentaren visas för rapportören och sparas i historiken. Högst 2000 tecken.</span>
      </div> : <p>Rapporten godkänns och blir klar för fakturering. Ditt namn och tidpunkten sparas i historiken.</p>}
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={busy || conflict}>{busy ? "Sparar…" : action === "approve" ? "Bekräfta godkännande" : "Skicka begäran"}</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => { setAction(null); setMessage(""); }}>Avbryt</button>
      </div>
    </form>}
    {message && <p className="form-error" role="alert">{message}</p>}
    {conflict && <button type="button" className="text-button" onClick={() => {
      if (comment.trim() && !window.confirm("Kommentaren i formuläret försvinner när du öppnar den senaste rapporten. Vill du fortsätta?")) return;
      router.refresh();
    }}>Öppna den senaste rapporten</button>}
  </section>;
}
