import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function embedBatch(batchId: string) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("🧠 Embedding batch:", batchId);
  const { data: chunks, error: loadErr } = await supabase
    .from("kb_chunks")
    .select("id, content")
    .eq("batch_id", batchId);

  if (loadErr) throw new Error(`Failed to load chunks: ${loadErr.message}`);
  if (!chunks?.length) return { count: 0 };

  const embeds = [];
  for (const ch of chunks) {
    const e = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: ch.content,
    });
    embeds.push({
      id: ch.id,
      embedding: e.data[0].embedding,
      batch_id: batchId,
    });
  }

  const { error: upErr } = await supabase.from("kb_embeddings").upsert(embeds);
  if (upErr) throw new Error(`Embedding upsert failed: ${upErr.message}`);

  console.log(`✅ Embedded ${embeds.length} chunks for batch ${batchId}`);
  return { count: embeds.length };
}
