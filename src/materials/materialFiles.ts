// Material files are inlined as text at build time, so the single-file page
// needs no network. The pattern covers data/<role>/ only: data/roles/ holds
// JSON configs and evaluator keys live outside data/ entirely.
const rawFiles = import.meta.glob("../../data/*/*.{csv,md}", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

// Keys match the "file" paths used in role configs, e.g. "data/category-manager/x.csv".
const filesByPath = new Map(Object.entries(rawFiles).map(([path, text]) => [path.replace("../../", ""), text]));

export function getMaterialText(file: string): string | undefined {
  return filesByPath.get(file);
}
