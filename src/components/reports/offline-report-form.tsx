"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TemplateForm, type TemplateFormProps, type FormSnapshot } from "./template-form";
import { enableOffline, localDrafts, offlineOwner, prepareOffline, removeLocalDraft, requireOfflineIdentity, saveLocalDraft, withOfflineLock, type LocalDraft } from "@/lib/offline-store";

export type OfflineReportFormProps = TemplateFormProps & { userId: string; companyName: string; localDraft?: LocalDraft };

export function OfflineReportForm(props: OfflineReportFormProps) {
  const [ready, setReady] = useState(false);
  const [candidate, setCandidate] = useState<LocalDraft | null>(null);
  const [restored, setRestored] = useState<LocalDraft | undefined>(props.localDraft);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const active = useRef(false);
  const localRevision = useRef(props.localDraft?.localRevision ?? 0);
  const latest = useRef<FormSnapshot | null>(null);
  const base = useRef(props);
  const selected = useRef(props.localDraft);
  const failed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setOnline(navigator.onLine);
      try {
        const allowed = offlineOwner() === props.userId;
        setEnabled(allowed);
        if (!props.localDraft) {
          const found = localDrafts(props.userId).find((draft) => draft.organizationId === props.organizationId &&
            (props.reportId ? draft.reportId === props.reportId || draft.id === props.reportId : !draft.reportId && draft.templateVersionId === props.templateVersionId));
          setCandidate(found ?? null);
          active.current = allowed && !found;
        } else active.current = allowed;
      } catch { setNotice("Lokala uppgifter kunde inte läsas. Använd inte omladdning för att spara ändringar."); }
      setReady(true);
    });
    const connect = () => setOnline(navigator.onLine);
    const checkOwner = () => {
      try {
        if ((active.current || props.localDraft) && offlineOwner() !== props.userId) {
          active.current = false;
          setCleared(true);
        }
      } catch { active.current = false; setCleared(true); }
    };
    window.addEventListener("online", connect);
    window.addEventListener("offline", connect);
    window.addEventListener("storage", checkOwner);
    window.addEventListener("pageshow", checkOwner);
    return () => {
      cancelled = true;
      window.removeEventListener("online", connect); window.removeEventListener("offline", connect);
      window.removeEventListener("storage", checkOwner); window.removeEventListener("pageshow", checkOwner);
    };
  }, [props.userId, props.organizationId, props.reportId, props.templateVersionId, props.localDraft]);

  const capture = useCallback((snapshot: FormSnapshot) => {
    latest.current = snapshot;
    if (!active.current || failed.current) return;
    void withOfflineLock(() => {
      if (!active.current || failed.current) return;
      const source = selected.current ?? base.current;
      try {
        const saved = saveLocalDraft({
          id: snapshot.id, userId: base.current.userId, organizationId: source.organizationId,
          companyName: source.companyName, definition: source.definition, templateVersionId: source.templateVersionId,
          reportId: source.reportId, revision: source.revision, completion: source.completion,
          answers: snapshot.answers, automaticTimeFields: snapshot.automaticTimeFields,
          localRevision: localRevision.current, savedAt: "",
        }, localRevision.current);
        localRevision.current = saved.localRevision;
        setNotice("Sparat på den här enheten – inte skickat till servern.");
      } catch (error) {
        failed.current = true;
        setNotice(`Kunde inte spara lokalt. ${error instanceof Error ? error.message : "Lagringen kan vara full eller blockerad."} Behåll formuläret öppet.`);
      }
    }).catch(() => { failed.current = true; setNotice("Kunde inte spara lokalt. Behåll formuläret öppet och spara på servern när du har täckning."); });
  }, []);

  async function enable() {
    setPreparing(true);
    try {
      await prepareOffline();
      enableOffline(props.userId);
      active.current = true;
      failed.current = false;
      setEnabled(true);
      if (latest.current) capture(latest.current);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Offlineläget kunde inte aktiveras."); }
    finally { setPreparing(false); }
  }

  function restore() {
    if (!candidate) return;
    localRevision.current = candidate.localRevision;
    selected.current = candidate;
    active.current = true;
    setRestored(candidate);
    setCandidate(null);
  }

  async function discard() {
    if (!candidate || !window.confirm("Ta bort det lokala utkastet och visa uppgifterna från servern?")) return;
    try {
      await withOfflineLock(() => removeLocalDraft(candidate.id, props.userId, candidate.localRevision));
      localRevision.current = 0;
      active.current = enabled;
      setCandidate(null);
    } catch (error) { setNotice(String(error)); }
  }

  async function synced() {
    active.current = false;
    if (latest.current && enabled) {
      try { await withOfflineLock(() => removeLocalDraft(latest.current!.id, props.userId, localRevision.current)); }
      catch { /* A newer edit in another tab must remain available locally. */ }
    }
  }

  if (!ready) return <p role="status">Kontrollerar lokala utkast…</p>;
  if (cleared) return <p role="alert">Lokala uppgifter har rensats eller kontot har bytts i en annan flik. <a href="/logga-in">Logga in igen</a>.</p>;
  const source = restored ? { ...restored, initialAnswers: restored.answers, initialId: restored.id } : props;
  return <>
    <section className="notice offline-notice" aria-label="Spara på enheten">
      <div>
        <h2>{online ? "Arbeta även utan täckning" : "Ingen nätanslutning"}</h2>
        {!enabled && <><p>Aktivera på din egen telefon innan du lämnar täckning. Öppnade formulär och utkast sparas då på enheten. Den som använder samma webbläsare kan läsa dem. Utloggning rensar lokala uppgifter.</p>
          <button type="button" className="button-secondary" disabled={preparing} onClick={() => void enable()}>{preparing ? "Förbereder…" : "Aktivera offline på den här enheten"}</button></>}
        {enabled && <p>Ändringar sparas lokalt. När du har täckning väljer du Spara utkast eller Skicka in. Webbläsarens data får inte rensas innan uppgifterna finns på servern.</p>}
        {!online && <p>Du kan fortsätta fylla i. Inskick och sparande på servern kräver anslutning.</p>}
        {notice && <p role="status">{notice}</p>}
        <a href="/offline">Lokala utkast och sparade mallar</a>
      </div>
    </section>
    {candidate ? <section className="form-section">
      <h2>Det finns ett lokalt utkast</h2>
      <p>Sparat {new Date(candidate.savedAt).toLocaleString("sv-SE")}. Lokala uppgifter har inte bekräftats av servern. Om rapporten ändrats där kontrolleras det när du sparar.</p>
      <button type="button" className="button-primary" onClick={restore}>Fortsätt med lokalt utkast</button>{" "}
      <button type="button" className="text-button" onClick={discard}>Ta bort lokalt utkast</button>
    </section> : <TemplateForm {...source} key={restored?.id ?? "server"}
      onLocalChange={capture} beforePersist={async () => { if (enabled) await withOfflineLock(() => {}); await requireOfflineIdentity(props.userId); }} onPersisted={synced} />}
  </>;
}
