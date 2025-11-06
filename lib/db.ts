import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface ChunkRow {
  id: string;
  item_id: string;
  batch_id: string;
  ord: number;
  content: string;
  token_count: number;
  created_at: string;
}

export async function saveItemsToSupabase(items: any[]) {
  const { error } = await supabase.from("kb_items").upsert(items, { onConflict: "id" });
  if (error) throw new Error("kb_items upsert failed: " + error.message);
}

export async function saveChunksToSupabase(chunks: ChunkRow[]) {
  const { error } = await supabase.from("kb_chunks").upsert(chunks, { onConflict: "id" });
  if (error) throw new Error("kb_chunks upsert failed: " + error.me  if (error) thcat > lib/embed.ts <<'EOF'
import OpenAI from "openai";
import { supabase } from "./db.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedBatch(batchId: string) {
  const { data: chunks } = await supabase.from("kb_chunks").select("*").eq("batch_id", batchId);
  if (!chunks?.length) return { count: 0 };
  const inputs = chunks.map((c: any) => c.content);
  const resp = await client.embeddings.create({ model: "text-embedding-3-small", input: inputs });
  const rows = chunks.map((c: any, i: number) => ({
    item_id: c.item_id,
    batch_id: batchId,
    embedding: resp.data[i].embedding,
  }));
  const { error } = await supabase.from("kb_embeddings").upsert(rows, { onConflict: "item_id" });
  if (error) throw new Error("kb_embeddings upsert failed: " + error.message);
  return { count: rows.length };
}
