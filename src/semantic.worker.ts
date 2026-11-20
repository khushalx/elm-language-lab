import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
env.allowLocalModels = false;
env.useBrowserCache = true;
// A single worker thread keeps the UI responsive and avoids cross-origin isolation requirements.
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
const createExtractor = pipeline as (task: 'feature-extraction', model: string, options: { dtype: 'q8'; device: 'wasm'; progress_callback: (progress: { status: string; progress?: number }) => void }) => Promise<FeatureExtractionPipeline>;
let extractor: FeatureExtractionPipeline | null = null;
const cache = new Map<string, number[]>();
self.onmessage = async (event: MessageEvent<{ id: number; words: string[] }>) => {
  const { id, words } = event.data;
  try {
    if (!extractor) {
      self.postMessage({ type: 'progress', id, message: 'Downloading MiniLM · first run only' });
      extractor = await createExtractor('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        dtype: 'q8', device: 'wasm',
        progress_callback: (p) => { if (p.status === 'progress') self.postMessage({ type: 'progress', id, message: `Loading model · ${Math.round(p.progress ?? 0)}%`, progress: p.progress }); },
      });
    }
    const missing = words.filter(w => !cache.has(w));
    if (missing.length) {
      self.postMessage({ type: 'progress', id, message: 'Computing 384-dimensional embeddings…' });
      const output = await extractor(missing, { pooling: 'mean', normalize: true });
      const vectors = output.tolist() as number[][];
      missing.forEach((word, i) => cache.set(word, vectors[i]));
    }
    self.postMessage({ type: 'result', id, vectors: Object.fromEntries(words.map(w => [w, cache.get(w)])) });
  } catch (error) {
    extractor = null;
    self.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
  }
};
