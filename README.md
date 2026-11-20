# ELM — Language Model Pipeline

An interactive desktop language laboratory built with React, Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide and React Flow.

## Run

```sh
npm install
npm run dev
```

`npm test` validates tokenizer round trips and similarity calculations. `npm run build` checks TypeScript and produces `dist/`.

## Accurate by design

- **BPE:** js-tiktoken, explicitly using `cl100k_base`. Its shipped rank data supplies all IDs and raw token bytes. Whitespace is shown visibly. Incomplete UTF-8 sequences display their hexadecimal bytes rather than a misleading replacement character.
- **Vocabulary:** 100,256 ordinary tokens + 5 special tokens = 100,261 supported tokens. The ID capacity of 100,277 includes 16 unused slots. These quantities are computed from bundled metadata, not conflated.
- **Token vectors:** explicitly illustrative, deterministic 12-dimensional visual teaching values. They are not learned weights.
- **Semantic similarity:** actual 384-dimensional, mean-pooled, normalized sentence embeddings from `Xenova/all-MiniLM-L6-v2` (q8), running in a browser Web Worker through Transformers.js. The first use downloads approximately 23 MB from Hugging Face; browser caching and an in-memory phrase cache avoid repeat downloads/computation. The app never sends text to an inference API. Failed downloads show an error and retry.
- **Spelling similarity:** normalized Unicode-aware Levenshtein similarity, `1 − distance / max(lengths)`, after NFC normalization and lowercasing.
- **Graph:** radial distance is `84 + (1 − score) × 205`. Angular placement only separates nodes and has no semantic meaning. Non-reference pairwise distances are not an embedding projection. Nodes are intentionally not draggable, preserving score-driven distances; pan and zoom remain enabled.
- **Toy UNK:** a deliberately restricted word vocabulary demonstrates unknown tokens. It does not represent cl100k_base behavior.

Short phrases work in both graph modes; the MiniLM model is primarily English. Cosine similarity is a model-dependent signal, not a calibrated probability. MiniLM's own tokenizer is independent of the cl100k_base pipeline.

## Sources

- https://github.com/openai/tiktoken/blob/main/tiktoken_ext/openai_public.py
- https://huggingface.co/docs/transformers.js/en/pipelines
- https://huggingface.co/Xenova/all-MiniLM-L6-v2

## Deploy to Vercel

Import this repository with its root directory set to the repository root. The included `vercel.json` selects Vite, installs from the lockfile, and publishes `dist/`. Node.js is pinned to the tested 24.x release line.

The install command sets `ONNXRUNTIME_NODE_INSTALL_CUDA=skip`. Transformers.js includes a Node ONNX dependency whose Linux installer otherwise tries to download CUDA binaries. ELM uses the browser's WASM runtime, so those server GPU binaries are unnecessary. Other dependency install scripts still run normally.
