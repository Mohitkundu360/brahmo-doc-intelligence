import { NextRequest, NextResponse } from "next/server";
import { generateNegotiationAdvice } from "@/lib/negotiation-advisor";
import { ComparisonResult, KnowledgeNode } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { results, knowledgeNodes } = (await req.json()) as {
      results: ComparisonResult[];
      knowledgeNodes: KnowledgeNode[];
    };
    const suggestions = generateNegotiationAdvice(results, knowledgeNodes);
    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
