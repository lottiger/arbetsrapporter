"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({
        email: String(data.get("email")).trim(),
        password: String(data.get("password")),
        rememberMe: false,
      });
      if (result.error) {
        setError(result.error.status === 429
          ? "För många inloggningsförsök. Vänta en minut och försök igen."
          : result.error.status >= 500
            ? "Inloggningstjänsten kunde inte nås. Försök igen om en stund."
            : "Inloggningen misslyckades. Kontrollera e-postadress och lösenord.");
        return;
      }
      router.replace("/foretag");
      router.refresh();
    } catch {
      setError("Kunde inte ansluta. Kontrollera internetanslutningen och försök igen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form" aria-busy={pending}>
      <label htmlFor="email">E-postadress</label>
      <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} autoCapitalize="none" spellCheck={false} />
      <label htmlFor="password">Lösenord</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button-primary" disabled={pending} type="submit">{pending ? "Loggar in…" : "Logga in"}</button>
      <p className="form-help">Du får ditt konto av administratören. Kontakta administratören om du behöver hjälp att logga in.</p>
    </form>
  );
}
