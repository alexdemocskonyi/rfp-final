import { NextResponse } from "next/server";
import OpenAI from "openai";
import { withGPT5Fallback } from "../../lib/withGPT5Fallback.js";
import { supa, assertSupa } from "../../lib/supadb.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GLOBAL_TIMEOUT_MS = 5 * 60 * 1000;

export async function POST(req) {
  const supabase = assertSupa();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const start = Date.now();

  try {
    const { text, questions } = await req.json();
    const qList = Array.isArray(questions) && questions.length
      ? questions
      : text.split(/\\n+/).map((l) => l.trim()).filter((l) => l.length > 6);

    const sections = [];
    for (const q of qList) {
      if (Date.now() - start > GLOBAL_TIMEOUT_MS) throw new Error("Global timeout exceeded (5m)");
      const { data } = await supabase.rpc("search_kb_items", { q, lim: 6 });
      const top = (data || []).slice(0, 3);
      const ctx = top.map((t, i) => `(${i + 1}) Q: ${t.q}\\nA: ${t.a}`).join("\\n\\n");
      const aiText = await withGPT5Fallback({
        system: "You are an expert RFP responder.",
        prompt: `Question: ${q}\\n\\nContext:\\n${ctx}`,
        perQuestionTimeoutMs: 10000
      });
      sections.push({ question: q, ai: aiText });
    }

    const markdown = "# RFP AI Generated Document\\n\\n" +
      sections.map((s, i) => `## Q${i + 1}. ${s.question}\\n\\n${s.ai}`).join("\\n\\n---\\n\\n");

    return NextResponse.json({ ok: true, markdown });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
