export function spellingSimilarity(a: string, b: string) {
  const x = Array.from(a.normalize('NFC').toLocaleLowerCase());
  const y = Array.from(b.normalize('NFC').toLocaleLowerCase());
  if (!x.length && !y.length) return 1;
  let previous = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(x[i - 1] !== y[j - 1]));
    previous = row;
  }
  return 1 - previous[y.length] / Math.max(x.length, y.length);
}
export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) throw new Error('Embedding dimensions must match.');
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? Math.max(-1, Math.min(1, dot / Math.sqrt(na * nb))) : 0;
}
export function graphRadius(score: number) { return 84 + (1 - Math.max(-1, Math.min(1, score))) * 205; }
