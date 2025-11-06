import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import pdfjsLib from "pdfjs-dist";

async function extractTextFromPDF(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(i => i.str).join(" ") + "\\n";
  }
  return text;
}

export default async function handler(req, res) {
  try {
    const { batch_id } = await req.json();
    if (!batch_id) return res.status(400).json({ ok: false, error: "Missing batch_id" });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: batch } = await supabase.from("kb_batches").select().eq("id", batch_id).single();
    if (!batch) throw new Error("Batch not found");

    const blob = await fetch(batch.blob_url);
    const buf = Buffer.from(await blob.arrayBuffer());
    const name = batch.filename.toLowerCase();

    let qaPairs = [];
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = XLSX.read(buf, { type: "buffer" });
      wb.SheetNames.forEach(sn => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
        rows.forEach(r => {
          const q = r.Q || r.Question || r.prompt || "";
          const a = r.A || r.Answer || r.response || "";
          if (q && typeof q === "string") qaPairs.push({ question: q.trim(), answer: String(a || "").trim() });
        });
      });
    } else if (name.endsWith(".docx")) {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      qaPairs.push({ question: value.slice(0, 100), answer: value.slice(100, 500) });
    } else if (name.endsWith(".pdf")) {
      const text = await extractTextFromPDF(buf);
      qaPairs.push({ question: text.slice(0, 200), answer: text.slice(200, 800) });
    } else if (name.endsWith(".csv")) {
      const wb = XLSX.read(buf, { type: "buffer" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      rows.forEach(r => {
        const q = r.Q || r.Question || r.prompt || "";
        const a = r.A || r.Answer || r.response || "";
        if (q && typeof q === "string") qaPairs.push({ question: q.trim(), answer: String(a || "").trim() });
      });
    }

    await supabase.rpc("init_kb_items").catch(async () => {
      await supabase.rpc("sql", {
        sql: `
        create table if not exists kb_items (
          id uuid primary key default gen_random_uuid(),
          batch_id uuid references kb_batches(id),
          question text,
          answer text,
          created_at timestamptz default now()
        );
      `});
    });

    for (const qa of qaPairs) {
      await supabase.from("kb_items").insert({ batch_id, question: qa.question, answer: qa.answer });
    }

    await supabase.from("kb_batches").update({ status: "processed" }).eq("id", batch_id);
    res.json({ ok: true, count: qaPairs.length });
  } catch (err) {
    console.error("❌ process error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
