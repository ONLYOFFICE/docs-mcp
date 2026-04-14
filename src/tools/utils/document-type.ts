export function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === 0) return "";
  return filename.slice(dotIndex + 1).toLowerCase();
}

export function getDocumentType(ext: string): string {
  if (["xlsx", "ods", "csv"].includes(ext)) return "cell";
  if (["pptx", "odp"].includes(ext)) return "slide";
  return "word";
}
