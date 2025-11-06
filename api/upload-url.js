import { NextResponse } from "next/server";
import { supa, assertSupa } from "../../lib/supadb.js";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(){
  const supabase=assertSupa();
  const { data, error }=await supabase.storage.createSignedUploadUrl("rfp-uploads");
  if(error) return NextResponse.json({ ok:false, error:error.message },{status:500});
  return NextResponse.json({ ok:true, ...data });
}
