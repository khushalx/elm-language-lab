import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, Handle, Position, type NodeProps, type Node, type Edge, ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Plus, X, Crosshair, RotateCcw, Network, LoaderCircle, Info, Check, AlertCircle } from 'lucide-react';
import { cosineSimilarity, graphRadius, spellingSimilarity } from './metrics';
const DEFAULT = ['cat', 'kitten', 'car', 'dog', 'automobile', 'puppy'];
type Mode = 'spelling' | 'meaning';
type WordData = { label: string; score: number; reference: boolean; color: string; metric: string };
type WordNode = Node<WordData, 'word'>;
function Word({ data }: NodeProps<WordNode>) {
  return <button type="button" className={`word-node ${data.reference ? 'reference' : ''}`} style={{ '--node-color': data.color } as React.CSSProperties} title={data.reference ? `${data.label} · reference word` : `${data.label} · ${data.metric}: ${data.score.toFixed(4)}`}>
    <Handle type="target" position={Position.Left} /><span className="node-mark">{data.reference ? <Crosshair size={13} /> : <span />}</span><span>{data.label}</span>{!data.reference && <small>{data.score.toFixed(2)}</small>}<Handle type="source" position={Position.Right} />
  </button>;
}
const nodeTypes = { word: Word };
const colors = ['#b7a1dc', '#e3bc7a', '#78c7bb', '#88acd7', '#d898ab', '#abc47e'];
export default function SimilarityGraph({ incoming, onClear }: { incoming: { words: string[]; revision: number } | null; onClear: () => void }) {
  const [words, setWords] = useState(DEFAULT);
  const [generated, setGenerated] = useState(DEFAULT);
  const [draft, setDraft] = useState('');
  const [reference, setReference] = useState('cat');
  const [mode, setMode] = useState<Mode>('spelling');
  const [vectors, setVectors] = useState<Record<string, number[]>>({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [inspect, setInspect] = useState('car');
  const [editing, setEditing] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const latestWords = useRef(DEFAULT);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => () => { worker.current?.terminate(); if(timeout.current) clearTimeout(timeout.current); }, []);
  useEffect(() => {
    if (!incoming) return;
    const incomingWords = [...new Set(incoming.words)].slice(0, 12);
    if (incomingWords.length >= 2) { setWords(incomingWords); setReference(incomingWords[0]); setNotice('Words imported. Generate to compare.'); }
    else setNotice('Select at least two different words in the text above.');
  }, [incoming]);
  function add() {
    const additions = draft.split(/[,\n]+/).map(w => w.trim()).filter(Boolean);
    if (additions.some(w => Array.from(w).length > 80)) { setNotice('Keep each word or phrase to 80 characters.'); return; }
    const next = [...new Set([...words, ...additions])];
    if (next.length > 12) { setNotice('A graph can contain up to 12 words or phrases.'); return; }
    setWords(next); setDraft(''); setNotice('');
  }
  function loadSemantics(list: string[]) {
    if (list.every(w => vectors[w])) return;
    setError(''); setBusy(true); setStatus('Preparing local sentence model…');
    const id = ++request.current;
    if (!worker.current) {
      worker.current = new Worker(new URL('./semantic.worker.ts', import.meta.url), { type: 'module' });
      worker.current.onmessage = event => {
        const data = event.data;
        if (data.id !== request.current) return;
        if (data.type === 'progress') setStatus(data.message);
        else if (data.type === 'result') { if(timeout.current) clearTimeout(timeout.current); setVectors(v => ({ ...v, ...data.vectors })); setBusy(false); setStatus('MiniLM ready · cached locally'); }
        else { if(timeout.current) clearTimeout(timeout.current); setBusy(false); setError('The semantic model could not load. Check your connection, then retry.'); }
      };
      worker.current.onerror = () => { if(timeout.current) clearTimeout(timeout.current); setBusy(false); setError('The semantic model could not start in this browser. Retry or use spelling mode.'); worker.current?.terminate(); worker.current = null; };
    }
    if(timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => { worker.current?.terminate(); worker.current = null; setBusy(false); setError('The model download took too long. Check your connection and retry.'); }, 180000);
    worker.current.postMessage({ id, words: list });
  }
  function generate() {
    if (words.length < 2) { setNotice('Add at least two words to compare.'); return; }
    setGenerated([...words]); latestWords.current = [...words];
    if (!words.includes(reference)) setReference(words[0]);
    setNotice(''); setInspect(words.find(w => w !== reference) || words[0]);
    if (mode === 'meaning') loadSemantics(words);
  }
  function changeMode(next: Mode) { setMode(next); if (next === 'meaning') loadSemantics(generated); }
  const activeReference = generated.includes(reference) ? reference : generated[0];
  const ready = mode === 'spelling' || generated.every(w => vectors[w]);
  const dirty = words.join('\0') !== generated.join('\0');
  const rankings = useMemo(() => generated.filter(w => w !== activeReference).map(word => ({ word, score: mode === 'spelling' ? spellingSimilarity(activeReference, word) : vectors[word] && vectors[activeReference] ? cosineSimilarity(vectors[activeReference], vectors[word]) : 0 })).sort((a, b) => b.score - a.score), [generated, activeReference, mode, vectors]);
  const selected = rankings.find(r => r.word === inspect) || rankings[0];
  const metric = mode === 'spelling' ? 'Normalized Levenshtein' : 'Cosine similarity';
  const graph = useMemo(() => {
    const nodes: WordNode[] = [{ id: activeReference, type: 'word', position: { x: 0, y: 0 }, data: { label: activeReference, score: 1, reference: true, color: '#f17868', metric }, origin: [0.5, 0.5] }];
    const edges: Edge[] = [];
    // Angles only separate labels. Radial distance alone encodes similarity.
    generated.filter(w => w !== activeReference).forEach((word, i, list) => {
      const score = rankings.find(r => r.word === word)?.score ?? 0;
      const angle = -Math.PI / 2 + (i * 2 * Math.PI / list.length);
      const radius = graphRadius(score);
      nodes.push({ id: word, type: 'word', position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }, data: { label: word, score, reference: false, color: colors[i % colors.length], metric }, origin: [0.5, 0.5] });
      edges.push({ id: `${activeReference}-${word}`, source: activeReference, target: word, type: 'straight', style: { stroke: colors[i % colors.length], strokeOpacity: 0.35, strokeWidth: 1 }, interactionWidth: 16 });
    });
    return { nodes, edges };
  }, [activeReference, generated, rankings, metric]);
  function reset() { setWords(DEFAULT); setGenerated(DEFAULT); latestWords.current = DEFAULT; setReference('cat'); setMode('spelling'); setDraft(''); setNotice(''); setInspect('car'); setEditing(null); setResetKey(k=>k+1); onClear(); }
  return <section id="similarity" className="similarity-section">
    <div className="section-heading"><div><div className="eyebrow"><Network size={14} /> THE SIMILARITY LAB</div><h2>Same letters. Different worlds.</h2><p>Change the lens. Watch relationships rearrange.</p></div><div className="segmented" role="group" aria-label="Similarity metric"><button className={mode === 'spelling' ? 'selected' : ''} onClick={() => changeMode('spelling')}>Spelling similarity</button><button className={mode === 'meaning' ? 'selected' : ''} onClick={() => changeMode('meaning')}>Meaning similarity</button></div></div>
    <div className="graph-shell">
      <div className="graph-input"><div className="chip-input">{words.map(w => <div className={`editable-chip ${reference === w ? 'is-ref' : ''}`} key={w}>
        {editing === w ? <input aria-label={`Edit ${w}`} autoFocus defaultValue={w} maxLength={80} onKeyDown={e => { if(e.key === 'Enter') e.currentTarget.blur(); if(e.key === 'Escape') setEditing(null); }} onBlur={e => {const val=e.target.value.trim(); if(val && !words.includes(val)){setWords(words.map(x=>x===w?val:x)); if(reference===w)setReference(val);} setEditing(null);}} /> : <button title="Double-click to edit; click to select as reference" onClick={() => setReference(w)} onDoubleClick={() => setEditing(w)}>{reference === w && <Crosshair size={12} />}{w}</button>}
        <button className="chip-remove" aria-label={`Remove ${w}`} onClick={() => {setWords(words.filter(x => x !== w)); if(reference === w) setReference(words.find(x=>x!==w) || '');}}><X size={12} /></button>
      </div>)}<input aria-label="Add words or phrases" placeholder="Add a word or phrase…" value={draft} maxLength={980} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();add();}}} /><button className="icon-button add-word" title="Add word" aria-label="Add word" onClick={add}><Plus size={17} /></button></div><button className="coral-button" onClick={generate} disabled={busy && mode === 'meaning'}>{busy && mode === 'meaning' ? <LoaderCircle size={14} className="spin"/> : <Network size={14}/>}Generate graph</button></div>
      <div className="graph-meta"><span><Crosshair size={12}/> Click a chip or node to choose the reference <span className="separator">·</span> {words.length}/12 words <span className="separator">·</span> Double-click a chip to edit</span><button className="quiet-button" onClick={reset}><RotateCcw size={12}/>Reset graph</button></div>
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="graph-body"><div className="graph-canvas">
        <div className="canvas-label"><span className={`tiny-square ${mode === 'meaning' ? 'purple' : ''}`}/>{mode === 'spelling' ? 'CHARACTER SPACE' : 'SEMANTIC SPACE'}<span className="canvas-sub">REFERENCE-CENTERED VIEW</span></div>
        {ready ? <ReactFlowProvider key={resetKey}><ReactFlow nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} fitView fitViewOptions={{padding:0.3,minZoom:0.4,maxZoom:1.1}} minZoom={0.25} maxZoom={2} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} onNodeClick={(_,node)=>{setReference(node.id);setInspect(generated.find(w=>w!==node.id)||'');}} onNodeMouseEnter={(_,node)=>{if(node.id!==activeReference)setInspect(node.id);}} proOptions={{hideAttribution:true}}><Background variant={BackgroundVariant.Lines} gap={30} color="#1c2028" lineWidth={0.6}/><Controls showInteractive={false} position="bottom-left"/></ReactFlow></ReactFlowProvider> : <div className="model-loading" role="status">{error ? <><AlertCircle size={25}/><h3>Model unavailable</h3><p>{error}</p><button className="outline-button" onClick={()=>loadSemantics(generated)}>Retry model download</button></> : <><LoaderCircle className="spin" size={27}/><h3>Making sense of your words</h3><p>{status || 'Preparing MiniLM…'}</p><small>First run downloads ~23 MB. Your words stay in this browser.</small></>}</div>}
        <div className="canvas-footer"><span><span className="legend-dot"/>Reference<span className="legend-dot muted"/>Comparison</span><span>Scroll to zoom <span className="separator">·</span> Drag to pan</span></div>
      </div><aside className="rankings"><div className="eyebrow">NEAREST TO <span className="accent">{activeReference}</span></div><div className="ranking-columns"><span>WORD / PHRASE</span><span>SCORE</span></div>{ready ? rankings.map((r,i)=><button key={r.word} className={`ranking ${selected?.word === r.word?'inspected':''}`} onClick={()=>setInspect(r.word)} onDoubleClick={()=>setReference(r.word)}><span className="rank-number">{String(i+1).padStart(2,'0')}</span><span className="rank-word">{r.word}<span className="rank-bar"><motion.span animate={{width:`${Math.max(0,r.score)*100}%`}} transition={{duration:0.5}}/></span></span><span className="score">{r.score.toFixed(3)}</span></button>) : <p className="waiting-copy">Scores appear after the model loads.</p>}
      <div className="metric-card"><span className="eyebrow">THE MEASURE</span><strong>{metric}</strong><p>{mode==='spelling'?'1 − edit distance ÷ longest length. Case-insensitive, Unicode-aware.':'Cosine of 384-dimensional MiniLM sentence vectors. Mean pooled & normalized.'}</p><span className="metric-range">{mode==='spelling'?'0 unrelated letters':'−1 opposite direction'}<span>1 identical</span></span></div></aside></div>
      <div className="graph-explanation"><Info size={15}/><span>{mode==='spelling'?'These words are positioned according to how similar their letters are.':'These words are positioned according to how similar their meanings are.'} <span className="subtle">Closer to the reference = more similar. Angles carry no meaning.</span></span>{ready && selected && <span className="pair-score">{activeReference} / {selected.word} <strong>{selected.score.toFixed(3)}</strong></span>}</div>
      <div className="graph-status"><span>{mode==='meaning'?<><Check size={12}/>{ready?'Real sentence embeddings · all-MiniLM-L6-v2 · 384 dimensions':status || 'Model download required'}</>:<><Check size={12}/>Calculated locally · normalized Levenshtein distance</>}</span><span>{dirty?'Inputs changed · generate to apply':mode==='meaning'?'Separate model from the tokenizer above':'Try “cat”, “car”, and “kitten”'}</span></div>
    </div>
  </section>;
}
