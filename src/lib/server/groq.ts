/**
 * ─────────────────────────────────────────────────────────────────────
 *  Groq client — the arena's brain.
 *  Plain fetch (no SDK) so it works identically on Node & edge runtimes.
 *  Features: model fallback chain, JSON extraction/repair, retries.
 *  NEVER import this file from client code — server routes only.
 * ─────────────────────────────────────────────────────────────────────
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqJsonOptions {
  /** Models to try, in priority order. */
  models?: string[];
  temperature?: number;
  maxTokens?: number;
  /** Extra system instructions */
  system?: string;
  user: string;
  retries?: number;
}

/** Pull the first valid JSON object out of a model response (tolerates
 *  code fences, leading prose and reasoning models' quirks). */
export function extractJson<T>(raw: string): T {
  let s = raw.trim();
  // Strip markdown fences
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  // Fast path
  try {
    return JSON.parse(s) as T;
  } catch {
    /* keep going */
  }
  // Find outermost braces
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const candidate = s.slice(first, last + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // One repair pass: strip trailing commas
      try {
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1")) as T;
      } catch {
        /* fallthrough */
      }
    }
  }
  throw new Error("GROQ_JSON_PARSE_FAILED: " + s.slice(0, 200));
}

/** Choose the model list based on env + language. */
export function modelChain(language: string): string[] {
  const primary = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  const fallback = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-120b";
  const last = process.env.GROQ_FALLBACK_MODEL2 || "openai/gpt-oss-20b";
  const arabic = process.env.GROQ_MODEL_AR || "allam-2-7b";
  const chain = language === "ar" ? [primary, arabic, fallback, last] : [primary, fallback, last];
  return [...new Set(chain)];
}

interface ChatResponse {
  choices?: { message?: { content?: string; reasoning?: string } }[];
  error?: { message?: string };
}

async function callModel(model: string, opts: GroqJsonOptions, maxTokens?: number, reasoning?: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing — set it in .env");

  const isReasoner = model.startsWith("openai/gpt-oss");
  // Reasoning models spend completion tokens on hidden reasoning — give them
  // room for the actual JSON payload, and ask for low reasoning effort.
  const tokens = maxTokens ?? (isReasoner ? Math.max(opts.maxTokens ?? 4096, 9000) : opts.maxTokens ?? 4096);
  const effort = reasoning === "none-skip" ? undefined : reasoning ?? (isReasoner ? "low" : undefined);

  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.9,
    max_completion_tokens: tokens,
    response_format: { type: "json_object" },
  };
  if (effort) body.reasoning_effort = effort;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json()) as ChatResponse & { error?: { message?: string } };
    if (!res.ok) {
      const msg = data.error?.message || `HTTP ${res.status}`;
      // Adaptive downgrade 1: unknown/unsupported reasoning_effort → retry plain
      if (res.status === 400 && /reasoning_effort/i.test(msg) && effort) {
        return callModel(model, opts, tokens, "none-skip");
      }
      // Adaptive downgrade 2: output budget over the TPM cap → retry smaller
      if (res.status === 429 && /too large/i.test(msg) && tokens > 2500) {
        return callModel(model, opts, Math.floor(tokens * 0.55), effort === "none-skip" ? undefined : effort);
      }
      throw new Error(`GROQ_${res.status}: ${msg}`);
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("GROQ_EMPTY_CONTENT");
    return content;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Call Groq and parse JSON, walking the model fallback chain.
 * Returns the parsed object plus the model that served it.
 */
export async function groqJson<T>(opts: GroqJsonOptions): Promise<{ data: T; model: string }> {
  const models = opts.models && opts.models.length ? opts.models : modelChain("en");
  const attempts = opts.retries ?? 1;
  let lastErr: unknown;

  for (const model of models) {
    for (let i = 0; i <= attempts; i++) {
      try {
        const raw = await callModel(model, opts);
        return { data: extractJson<T>(raw), model };
      } catch (e) {
        lastErr = e;
        const msg = String(e);
        // Hard failures & rate limits → skip to next model immediately
        // (each model has its own tokens-per-minute bucket on Groq)
        if (/GROQ_401|GROQ_403|GROQ_429|terms/.test(msg)) break;
        console.warn(`[groq] ${model} attempt ${i + 1} failed: ${msg.slice(0, 160)}`);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Groq call failed");
}
