"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign-out failed");
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
