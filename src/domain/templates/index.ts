import type { TemplateDefinition } from "../templates.ts";
import { tmaTemplate } from "./tma.ts";
import { bargningTemplate } from "./bargning.ts";

/** Inbyggda mallar som publiceras per företag med npm run templates:publish. */
export const builtInTemplates: readonly TemplateDefinition[] = [tmaTemplate, bargningTemplate];

export function builtInTemplate(key: string) {
  return builtInTemplates.find((template) => template.key === key);
}
