import { inferMonacoLanguage } from "@/shared/lib/monaco";

export function inferConflictEditorLanguage(filePath: string) {
  return inferMonacoLanguage(filePath);
}
