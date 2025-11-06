function tokenize(s){ return (s||"").split(/\\s+/).filter(Boolean); }
export function makeChunks(text, targetTokens=280, overlap=40){
  const toks = tokenize(text); const out=[]; let ord=0;
  for(let i=0;i<toks.length;i+=(targetTokens-overlap)){
    const slice=toks.slice(i,i+targetTokens);
    if(!slice.length) break;
    out.push({ord:ord++,content:slice.join(" "),token_count:slice.length});
  }
  return out;
}
