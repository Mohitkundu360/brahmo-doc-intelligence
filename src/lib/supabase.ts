import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getKnowledgeNodes() {
  const { data, error } = await supabase
    .from("knowledge_nodes")
    .select("*")
    .order("id");
  if (error) throw error;
  return data;
}

export async function saveDocument(filename: string, contentText: string) {
  const { data, error } = await supabase
    .from("documents")
    .insert({ filename, content_text: contentText })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveChunks(chunks: object[]) {
  const { data, error } = await supabase
    .from("document_chunks")
    .insert(chunks)
    .select();
  if (error) throw error;
  return data;
}

export async function saveRiskScores(scores: object[]) {
  const { data, error } = await supabase
    .from("risk_scores")
    .insert(scores)
    .select();
  if (error) throw error;
  return data;
}
