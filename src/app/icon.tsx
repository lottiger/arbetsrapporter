import { appIcon } from "@/components/ui/app-icon";

export function generateImageMetadata() {
  return [32, 192, 512].map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return appIcon(Number(await id));
}
