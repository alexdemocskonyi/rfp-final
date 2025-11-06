import { put } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    const formBoundary = req.headers["content-type"].split("boundary=")[1];
    if (!formBoundary) throw new Error("Missing multipart boundary");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const fileStart = buffer.indexOf("\r\n\r\n") + 4;
    const fileEnd = buffer.lastIndexOf("--" + formBoundary) - 2;
    const fileData = buffer.slice(fileStart, fileEnd);

    // Upload to Vercel Blob Storage
    const blob = await put("uploads/upload-" + Date.now(), fileData, { access: "public" });

    // Init Supabase
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await supabase.rpc("ensure_schema", {}); // no-op safeguard

    // Ensure table exists
    await supabase.rpc("init_kb_batches").catch(async () => {
      await supabase.rpc("sql", {
        sql: `
        create table if not exists kb_batches (
          id uuid primary key default gen_random_uuid(),
          filename text,
          blob_url text,
          status text default uploaded,
          created_at timestamptz default now()
        );
      `});
    });

    const { data: inserted, error } = await supabase
      .from("kb_batches")
      .insert({ filename: "upload-" + Date.now(), blob_url: blob.url })
      .select()
      .single();

    if (error) throw error;

    res.json({ ok: true, batch_id: inserted.id, blob_url: blob.url });
  } catch (err) {
    console.error("❌ ingest error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
