"use client";

import { useEffect, useState } from "react";
import { clearOffline, localDrafts, localTemplates, offlineOwner, removeLocalDraft, withOfflineLock, type LocalDraft, type LocalTemplate } from "@/lib/offline-store";
import { OfflineReportForm } from "./offline-report-form";

export function OfflineWorkspace() {
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [selected, setSelected] = useState<LocalDraft | null>(null);
  const [templates, setTemplates] = useState<LocalTemplate[]>([]);
  const [message, setMessage] = useState("");
  function refresh() {
    try { const owner = offlineOwner(); setDrafts(owner ? localDrafts(owner) : []); setTemplates(owner ? localTemplates(owner) : []); }
    catch { setMessage("Lokala uppgifter kunde inte läsas. Rensa inte webbläsarens data om du har oskickade rapporter."); }
  }
  useEffect(() => {
    queueMicrotask(refresh);
    if (window.parent !== window) window.parent.postMessage("OFFLINE_WORKSPACE_READY", window.location.origin);
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === "arbetsrapporter.offline.v1.owner") setSelected(null);
      refresh();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  function clear() {
    if (!window.confirm("Radera alla lokala utkast och stäng av offlineläget på den här enheten? Uppgifter som inte skickats till servern försvinner.")) return;
    try { clearOffline(); setSelected(null); refresh(); }
    catch { setMessage("Uppgifterna kunde inte raderas. Försök igen."); }
  }
  async function remove(draft: LocalDraft) {
    if (!window.confirm("Radera detta lokala utkast? Det påverkar inte rapporter som redan finns på servern.")) return;
    try { await withOfflineLock(() => removeLocalDraft(draft.id, draft.userId, draft.localRevision)); refresh(); }
    catch { setMessage("Utkastet har ändrats i en annan flik. Ladda om listan innan du försöker igen."); }
  }
  return <>
    <header className="page-heading"><p className="eyebrow">PÅ DEN HÄR ENHETEN</p><h1>Lokala utkast</h1>
      <p>Här finns rapporter som sparats i den här webbläsaren. De är inte bekräftade av servern. Öppna en rapport och välj Spara utkast eller Skicka in när du har täckning.</p></header>
    <p><a href="/rapportor">Till appen när du har täckning</a>{" · "}<a href="/logga-in">Logga in igen</a></p>
    {message && <p role="alert" className="form-error">{message}</p>}
    {selected ? <>
      <button type="button" className="text-button" onClick={() => { setSelected(null); refresh(); }}>Till lokala utkast</button>
      <h2>{selected.definition.title} · {selected.companyName}</h2>
      <OfflineReportForm key={selected.id} {...selected} localDraft={selected} initialAnswers={selected.answers} initialId={selected.id} />
    </> : <>
      {!drafts.length && <p>Inga lokala utkast. Öppna ett rapportformulär med täckning och aktivera offline på enheten först.</p>}
      {drafts.map((draft) => <section className="form-section" key={draft.id}>
        <h2>{draft.definition.title}</h2><p>{draft.companyName} · {String(draft.answers.kund ?? "Kund inte angiven")}</p>
        <p>Sparat lokalt {new Date(draft.savedAt).toLocaleString("sv-SE")}</p>
        <div className="form-actions"><button type="button" className="button-primary" onClick={() => setSelected(draft)}>Öppna utkast</button>
          <button type="button" className="text-button" onClick={() => remove(draft)}>Radera lokalt utkast</button></div>
      </section>)}
      {templates.length > 0 && <section className="form-section"><h2>Ny rapport från sparad mall</h2>
        <p>Mallar som öppnats med offline aktiverat. Servern kontrollerar vid sparande att mallen fortfarande är publicerad.</p>
        {templates.map((template) => <p key={template.templateVersionId}><button type="button" className="button-secondary" onClick={() => setSelected({
          ...template, id: crypto.randomUUID(), answers: {}, automaticTimeFields: template.definition.rules.flatMap((rule) => rule.type === "time_span" ? [rule.billableHoursField] : []),
          localRevision: 0, savedAt: new Date().toISOString(),
        })}>{template.companyName} · {template.definition.title}</button></p>)}
      </section>}
    </>}
    <p><button type="button" className="text-button" onClick={clear}>Rensa enheten och stäng av offline</button></p>
  </>;
}
