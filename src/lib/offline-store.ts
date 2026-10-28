import type { Answers, TemplateDefinition } from "../domain/templates.ts";

export const OFFLINE_PREFIX = "arbetsrapporter.offline.v1.";
const OWNER = `${OFFLINE_PREFIX}owner`;
const DRAFT = `${OFFLINE_PREFIX}draft.`;
const TEMPLATE = `${OFFLINE_PREFIX}template.`;
export type LocalDraft = {
  id: string; userId: string; organizationId: string; companyName: string;
  templateVersionId: string; definition: TemplateDefinition;
  reportId?: string; revision?: number; completion?: boolean;
  answers: Answers; automaticTimeFields: string[];
  localRevision: number; savedAt: string;
};
export type LocalTemplate = Pick<LocalDraft, "userId" | "organizationId" | "companyName" | "templateVersionId" | "definition">;
export function localTemplates(userId: string, storage: Storage = localStorage): LocalTemplate[] {
  if (offlineOwner(storage) !== userId) return [];
  const result: LocalTemplate[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(TEMPLATE)) {
      const template = JSON.parse(storage.getItem(key)!) as LocalTemplate;
      if (template.userId === userId) result.push(template);
    }
  }
  return result;
}

export function offlineOwner(storage: Storage = localStorage) { return storage.getItem(OWNER); }
export function enableOffline(userId: string, storage: Storage = localStorage) {
  const owner = offlineOwner(storage);
  if (owner && owner !== userId) throw new Error("En annan användare har lokala uppgifter på enheten. Rensa dem först.");
  storage.setItem(OWNER, userId);
}
export function localDrafts(userId: string, storage: Storage = localStorage): LocalDraft[] {
  if (offlineOwner(storage) !== userId) return [];
  const drafts: LocalDraft[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(DRAFT)) continue;
    const draft = JSON.parse(storage.getItem(key)!) as LocalDraft;
    if (draft.userId === userId && draft.id && draft.definition?.sections && Number.isSafeInteger(draft.localRevision)) drafts.push(draft);
    else throw new Error("Lokala uppgifter kunde inte läsas.");
  }
  return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export function saveLocalDraft(draft: LocalDraft, expected: number, storage: Storage = localStorage): LocalDraft {
  if (offlineOwner(storage) !== draft.userId) throw new Error("Offlineläget har stängts av eller kontot har bytts.");
  const key = DRAFT + draft.id;
  const previous = storage.getItem(key);
  const current = previous ? JSON.parse(previous) as LocalDraft : null;
  if ((current?.localRevision ?? 0) !== expected) throw new Error("Utkastet har ändrats i en annan flik. Öppna Lokala utkast innan du fortsätter.");
  const saved = { ...draft, localRevision: expected + 1, savedAt: new Date().toISOString() };
  const { userId, organizationId, companyName, templateVersionId, definition } = draft;
  storage.setItem(TEMPLATE + organizationId + "." + templateVersionId, JSON.stringify({ userId, organizationId, companyName, templateVersionId, definition }));
  storage.setItem(key, JSON.stringify(saved));
  return saved;
}
export function removeLocalDraft(id: string, userId: string, expected: number, storage: Storage = localStorage) {
  if (offlineOwner(storage) !== userId) return;
  const key = DRAFT + id;
  const raw = storage.getItem(key);
  if (!raw) return;
  const draft = JSON.parse(raw) as LocalDraft;
  if (draft.userId !== userId || draft.localRevision !== expected) throw new Error("En annan flik har ändrat det lokala utkastet. Det har behållits på enheten.");
  storage.removeItem(key);
}
export function clearOffline(storage: Storage = localStorage) {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key?.startsWith(OFFLINE_PREFIX)) storage.removeItem(key);
  }
}

export async function withOfflineLock<T>(work: () => T | Promise<T>): Promise<T> {
  return await navigator.locks.request("arbetsrapporter-offline", work);
}

export async function prepareOffline() {
  if (!window.isSecureContext || !("serviceWorker" in navigator) || !navigator.locks) throw new Error("Offlineläget kräver HTTPS eller localhost och en modern webbläsare med stöd för offline.");
  await navigator.serviceWorker.register("/offline-worker.js", { scope: "/", updateViaCache: "none" });
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Offlineläget kunde inte förberedas. Kontrollera anslutningen och försök igen.")), 20000)),
  ]);
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error("Offlinesidan kunde inte laddas klart. Försök igen med täckning.")); }, 20000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      if (event.data?.ok) resolve();
      else reject(new Error("Offlinesidan kunde inte laddas klart. Försök igen med täckning."));
    };
    registration.active?.postMessage("PREPARE_OFFLINE", [channel.port2]);
  });
  // Hydrate the shell once online. Development mode and lazy chunks can load
  // additional static assets not listed directly in the initial HTML.
  await new Promise<void>((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.title = "Förbereder offlineläge";
    const cleanup = () => { clearTimeout(timer); window.removeEventListener("message", ready); frame.remove(); };
    const ready = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data !== "OFFLINE_WORKSPACE_READY") return;
      cleanup(); resolve();
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Offlinesidan kunde inte förberedas helt. Försök igen med täckning.")); }, 20000);
    window.addEventListener("message", ready);
    frame.src = "/offline";
    document.body.appendChild(frame);
  });
  // Request persistent storage where supported; refusal does not prevent local drafts.
  void navigator.storage?.persist?.().catch(() => {});
}

export async function requireOfflineIdentity(userId: string) {
  const response = await fetch("/api/auth/get-session", { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Logga in igen innan du sparar på servern. Det lokala utkastet finns kvar.");
  const session = await response.json();
  if (session?.user?.id !== userId) throw new Error("Logga in med kontot som skapade utkastet innan du sparar på servern.");
}
