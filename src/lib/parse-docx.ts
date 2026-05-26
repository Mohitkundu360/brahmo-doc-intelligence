import mammoth from "mammoth";

export async function parseDocx(
  fileBuffer: Buffer
) {
  try {
    const result =
      await mammoth.extractRawText({
        buffer: fileBuffer,
      });

    const cleanedText = result.value
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return cleanedText;
  } catch (error) {
    console.error(
      "DOCX parsing failed:",
      error
    );

    throw new Error(
      "Failed to parse DOCX file"
    );
  }
}