export function normalizeClauseText(text: string): string {
  return text
    .replace(/\s+/g, " ")

    // Fix merged numbers like 1812 -> 18 12
    .replace(/(\d)(\d{2})\s+months/g, "$1 $2 months")

    // Fix 3090 -> 30 90
    .replace(/(\d)(\d{2})\s+days/g, "$1 $2 days")

    // Fix merged clause numbers like 1512.
    .replace(/^(\d{2})(\d{2})\./, "$1.$2 ")

    .replace(/[^\w\s.%()-]/g, " ")
    .trim()
    .toLowerCase();
}