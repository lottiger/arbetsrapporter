import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Arbetsrapporter", template: "%s | Arbetsrapporter" },
  description: "Arbetsrapporter och fakturaunderlag på ett ställe.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Rapporter", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#21614d" };

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
