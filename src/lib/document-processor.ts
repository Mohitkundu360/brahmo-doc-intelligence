import mammoth from "mammoth";

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return cleanText(result.value);
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid SSR issues
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return cleanPdfText(data.text);
}

// Strip common PDF noise: page numbers, headers, footers
function cleanPdfText(raw: string): string {
  const lines = raw.split("\n");
  const cleaned = lines.filter((line) => {
    const t = line.trim();
    // Skip: lone page numbers
    if (/^\d+$/.test(t)) return false;
    // Skip: "Page X of Y"
    if (/^page\s+\d+\s+of\s+\d+$/i.test(t)) return false;
    // Skip: very short lines that are likely headers/footers
    if (t.length < 3 && lines.indexOf(line) > 0) return false;
    return true;
  });
  return cleanText(cleaned.join("\n"));
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n") // max 3 consecutive blank lines
    .replace(/[ \t]{2,}/g, " ")   // collapse horizontal whitespace
    .trim();
}

export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return extractTextFromPdf(buffer);
  if (ext === "docx") return extractTextFromDocx(buffer);
  throw new Error(`Unsupported file type: ${ext}. Use DOCX or PDF.`);
}
