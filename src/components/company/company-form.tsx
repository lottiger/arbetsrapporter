"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CompanyForm({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/foretag/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.get("name") }),
      });
      if (!response.ok) throw new Error("Save failed");
      setMessage("Företagsnamnet har sparats.");
      router.refresh();
    } catch { setMessage("Kunde inte spara. Kontrollera din behörighet och försök igen."); }
    finally { setPending(false); }
  }
  return (
    <form onSubmit={submit} className="auth-form company-form" aria-busy={pending}>
      <label htmlFor="company-name">Företagsnamn</label>
      <input name="name" id="company-name" defaultValue={name} minLength={2} maxLength={120} required />
      <button type="submit" className="button-primary" disabled={pending}>{pending ? "Sparar…" : "Spara företagsnamn"}</button>
      <p role="status">{message}</p>
    </form>
  );
}
