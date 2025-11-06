import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { batch_id } = await req.json();
    if (!batch_id) return res.status(400).json({ ok: false, error: "Missing batch_id" });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    await supabase.rpc("init_kb_embeddings").catch(async () => {
      await supabase.rpc("sql", {
        sql: `
        create table if not exists kb_embeddings (
          id uuid primary key default gen_random_uuid(),
          item_id uuid references kb_items(id),
          embedding jsonb,
          created_at timestamptz default now()
        );
      `});
    });

    const { data: items } = await supabase.from("kb_items").select("id,question").eq("batch_id", batch_id);
    if (!items?.length) throw new Error("No items for embedding");

    for (const item of items) {
      const emb = await openai.embeddings.create({ model: "text-embedding-3-large", input: item.question });
      await supabase.from("kb_embeddings").insert({ item_id: item.id, embedding: emb.data[0].embedding });
    }

    await supabase.from("kb_batches").update({ status: "embedded" }).eq("id", batch_id);
    res.json({ ok: true, embedded: items.length });
  } catch (err) {
    console.error("❌ embed error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
