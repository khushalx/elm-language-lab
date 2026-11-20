import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, encoder, vocabularySize, ordinarySize, specialSize } from '../src/tokenizer';
import { spellingSimilarity, cosineSimilarity, graphRadius } from '../src/metrics';
test('token IDs match the cl100k_base known reference',()=>assert.deepEqual(tokenize('hello world').map(x=>x.id),[15339,1917]));
test('whitespace, multilingual text, emoji and special-looking strings round trip',()=>{
 for(const text of ['  hello\nworld\t','ગુજરાતી हिन्दी 🐈‍⬛','猫はかわいい','<|endoftext|>','unhappiness','']){
 const tokens=tokenize(text);assert.equal(encoder.decode(tokens.map(t=>t.id)),text);
 const reconstructed=new TextDecoder().decode(Uint8Array.from(tokens.flatMap(t=>Array.from(t.bytes))));assert.equal(reconstructed,text);
 }
});
test('vocabulary counts supported IDs separately from capacity',()=>{assert.equal(ordinarySize,100256);assert.equal(specialSize,5);assert.equal(vocabularySize,100261);});
test('partial UTF-8 token pieces retain original bytes',()=>{const pieces=tokenize('🐈');assert.ok(pieces.some(t=>t.decoded===null));assert.ok(pieces.every(t=>t.bytes.length>0));});
test('normalized Levenshtein uses real edit distances and Unicode codepoints',()=>{assert.ok(Math.abs(spellingSimilarity('cat','car')-2/3)<1e-10);assert.equal(spellingSimilarity('CAT','cat'),1);assert.equal(spellingSimilarity('🐈','🐈'),1);assert.equal(spellingSimilarity('',''),1);assert.equal(spellingSimilarity('café','cafe\u0301'),1);});
test('cosine and radius preserve similarity ordering',()=>{assert.equal(cosineSimilarity([1,0],[1,0]),1);assert.equal(cosineSimilarity([1,0],[0,1]),0);assert.equal(cosineSimilarity([1,0],[-1,0]),-1);assert.ok(graphRadius(.9)<graphRadius(.2));});
