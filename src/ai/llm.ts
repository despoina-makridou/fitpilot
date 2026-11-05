import { initLlama, LlamaContext } from 'llama.rn';
import { ensureModel } from './model';

/**
 * Thin singleton wrapper around a llama.rn context running the bundled
 * Qwen2.5-0.5B GGUF entirely on-device (no network, no tokens billed).
 *
 * Used only for short generations: a one-line notification nudge and a short
 * in-app encouragement line. Kept tiny on purpose.
 */

let ctx: LlamaContext | null = null;
let initPromise: Promise<LlamaContext> | null = null;

export async function initLLM(onProgress?: (p: number) => void): Promise<LlamaContext> {
  if (ctx) return ctx;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Reassembly counts as the first half of progress, model load the second.
    const modelPath = await ensureModel((p) => onProgress?.(p * 0.5));
    const context = await initLlama(
      {
        model: modelPath,
        n_ctx: 1024, // small context is plenty for our prompts
        n_gpu_layers: 0, // CPU-only for broad device compatibility
      },
      (loadP) => onProgress?.(0.5 + loadP * 0.5),
    );
    ctx = context;
    return context;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function isLLMReady(): boolean {
  return ctx != null;
}

/**
 * Run a short chat completion. Returns trimmed text.
 * `system` steers style; `user` is the concrete request.
 */
export async function generate(
  system: string,
  user: string,
  maxTokens = 60,
): Promise<string> {
  const context = await initLLM();
  const result = await context.completion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    n_predict: maxTokens,
    temperature: 0.7,
    top_p: 0.9,
    stop: ['<|im_end|>', '\n\n'],
  });
  return (result.text ?? '').trim();
}

export async function releaseLLM(): Promise<void> {
  if (ctx) {
    await ctx.release();
    ctx = null;
  }
}
