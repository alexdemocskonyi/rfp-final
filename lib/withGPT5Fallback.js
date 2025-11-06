import OpenAI from "openai";
export async function withGPT5Fallback({ system, prompt, temperature=0.4, perQuestionTimeoutMs=10000 }){
  const client=new OpenAI({ apiKey:process.env.OPENAI_API_KEY });
  if(!client.apiKey) throw new Error("Missing OPENAI_API_KEY");
  const P=[{role:"system",content:system},{role:"user",content:prompt}];
  try{
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),perQuestionTimeoutMs);
    const r=await client.chat.completions.create({
      model:"gpt-5",
      temperature,
      messages:P,
      signal:ctrl.signal
    });
    clearTimeout(t);
    return (r.choices?.[0]?.message?.content||"").trim();
  }catch(e){
    console.warn("⚠️ GPT-5 timeout/fail -> using GPT-4:",e?.message||e);
    const r=await client.chat.completions.create({
      model:"gpt-4o-mini",
      temperature,
      messages:P
    });
    return (r.choices?.[0]?.message?.content||"").trim();
  }
}
