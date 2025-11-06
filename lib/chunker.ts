export function makeChunks(text: string, maxTokens = 400): { ord: number; content: string; token_count: number }[] {
  const parts = text.match(new RegExp(`.{1,${maxTokens}}`, "g")) || [];
  return parts.map((p, i) => ({ ord: i + 1, content: p, token_count: p.length }));
}
