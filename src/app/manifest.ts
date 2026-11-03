import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arbetsrapporter",
    short_name: "Rapporter",
    description: "Arbetsrapporter och fakturaunderlag på ett ställe.",
    lang: "sv",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f3",
    theme_color: "#21614d",
    icons: [192, 512].flatMap((size) => (["any", "maskable"] as const).map((purpose) => ({
      src: `/icon/${size}`, sizes: `${size}x${size}`, type: "image/png", purpose,
    }))),
  };
}
