import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Arbetsrapporter", template: "%s | Arbetsrapporter" },
  description: "Arbetsrapporter, granskning och faktureringsunderlag på ett ställe.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv">
      <body>
        <a className="skip-link" href="#huvudinnehall">Hoppa till innehållet</a>
        {children}
      </body>
    </html>
  );
}
