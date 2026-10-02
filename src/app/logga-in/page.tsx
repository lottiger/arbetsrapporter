import type { Metadata } from "next";
import { Brand } from "@/components/ui/brand";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Logga in" };

export default function SignInPage() {
  return (
    <main id="huvudinnehall" tabIndex={-1} className="auth-page">
      <Brand href="/" />
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">VÄLKOMMEN TILLBAKA</p>
        <h1 id="login-title">Logga in</h1>
        <p>Fortsätt till dina arbetsrapporter.</p>
        <SignInForm />
      </section>
    </main>
  );
}
