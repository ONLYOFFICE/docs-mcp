import { formatsProvider } from "./formats-provider.js";

export function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === 0) return "";
  return filename.slice(dotIndex + 1).toLowerCase();
}

export async function getDocumentType(extension: string): Promise<string | null> {
  const format = await formatsProvider.getDocFormatByExtension(extension);

  if (format?.type) return format.type;

  return null;
}

export async function isEditable(extension: string): Promise<boolean> {
  const format = await formatsProvider.getDocFormatByExtension(extension);

  return format?.actions.includes("edit") ?? false;
}
