import { Tiktoken } from 'js-tiktoken/lite';
import cl100k from 'js-tiktoken/ranks/cl100k_base';
export const encoder = new Tiktoken(cl100k);
// Read the shipped vocabulary data, rather than assuming that the maximum ID equals its size.
export const vocabulary = new Map<number, Uint8Array>();
for (const line of cl100k.bpe_ranks.split('\n').filter(Boolean)) {
  const [, offset, ...entries] = line.split(' ');
  entries.forEach((base64, i) => vocabulary.set(Number(offset) + i, Uint8Array.from(atob(base64), c => c.charCodeAt(0))));
}
export const ordinarySize = vocabulary.size;
export const specialSize = Object.keys(cl100k.special_tokens).length;
export const vocabularySize = ordinarySize + specialSize;
export const idCapacity = Math.max(...Object.values(cl100k.special_tokens), ...Array.from(vocabulary.keys()).slice(-100)) + 1;
export type Token = { id: number; label: string; decoded: string | null; hex: string; bytes: Uint8Array; start: number; end: number };
export const visible = (text: string) => text.replace(/ /g, '·').replace(/\n/g, '↵').replace(/\t/g, '⇥').replace(/\r/g,'␍');
export function describeToken(id: number, start = 0): Token {
  const bytes = vocabulary.get(id)!;
  let decoded: string | null = null;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { /* A token can contain only part of a Unicode character. */ }
  const hex = Array.from(bytes, x => x.toString(16).padStart(2, '0')).join(' ');
  return { id, bytes, decoded, label: decoded === null ? `⟨${hex}⟩` : visible(decoded), hex, start, end: start + bytes.length };
}
export function tokenize(text: string): Token[] {
  let offset = 0;
  // Special-looking strings typed by users remain ordinary text.
  return encoder.encode(text, [], []).map(id => {
    const token = describeToken(id, offset);
    offset = token.end;
    return token;
  });
}
// A deterministic teaching aid, deliberately not represented as learned weights.
export function illustrativeVector(id: number) {
  return Array.from({length:12},(_,i)=>Math.sin(id * 0.13 + i * 1.71) * 0.85);
}
