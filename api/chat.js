import { NextResponse } from "next/server";
import { supa, assertSupa } from "../../lib/supadb.js";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const question = (messages?.slice(-1)[0]?.content || "").trim();
    if (!question) throw new Error("Empty question");
    const supabase = assertSupa();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const emb = await openai.embeddings.create({ model: process.env.OPENAI_EMBED_MODEL, input: question });
    const qvec = emb.data?.[0]?.embedding;
    const { data: sem } = await supabase.rpc("match_kb_items", {
      query_embedding: qvec,
      match_count: 12
    });

    const ids = (sem || []).map(r => r.id);
    const { data: rows } = await supabase.from("kb_items").select("id,q,a,source").in("id", ids);
    const top = (rows || []).slice(0, 3);

    const prompt =
      `Question: ${question}\n\n` +
      top.map((t, i) => `(${i + 1}) Q: ${t.q}\nA: ${t.a}`).join("\n\n");

    const comp = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: "You are RFP AI. Use only the facts from provided materials." },
        { role: "user", content: prompt }
      ]
    });

    const ai = comp.choices[0]?.message?.content?.trim() || "(no AI output)";
    return NextResponse.json({
      ok: true,
      contextual: top[0] ? { text: top[0].a, sourceHint: top[0].source } : null,
      raw: top[1] ? { text: top[1].a, sourceHint: top[1].source } : null,
      ai
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
