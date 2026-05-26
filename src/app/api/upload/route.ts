import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/document-processor";
import { chunkDocument } from "@/lib/legal-chunker";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer, file.name);
    const chunks = chunkDocument(text);

    return NextResponse.json({
      filename: file.name,
      text,
      chunks,
      chunk_count: chunks.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
