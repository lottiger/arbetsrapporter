"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { clearOffline, localDrafts, offlineOwner } from "@/lib/offline-store";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    try {
      const owner = offlineOwner();
      if (owner && localDrafts(owner).length && !window.confirm("Du har lokala utkast. Om du loggar ut raderas de från enheten. Spara på servern först om du vill behålla dem. Logga ut ändå?")) return;
    } catch { setError(true); return; }
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign-out failed");
      clearOffline();
      window.location.replace("/logga-in");
    } catch {
      setError(true);
      setPending(false);
    }
  }
  return (
    <span className="sign-out-control">
      <button type="button" className="text-button" onClick={signOut} disabled={pending}>{pending ? "Loggar ut…" : "Logga ut"}</button>
      {error && <span role="alert">Utloggningen misslyckades. Försök igen.</span>}
    </span>
  );
}
