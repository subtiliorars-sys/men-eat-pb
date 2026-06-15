import { isFeedbackStatus, validateFeedbackSubmission, validateReviewDecision } from "./validation";
import type { FeedbackStatus } from "./schema";
import { D1FeedbackStore, type FeedbackStore } from "./store";

const DEFAULT_QUEUE_LIMIT = 50;
const MAX_QUEUE_LIMIT = 100;
const MAX_BODY_BYTES = 32_768;

export interface FeedbackApiEnv {
  DB: D1Database;
  MODERATOR_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
  REVIEW_BASE_URL?: string;
}

export interface HandlerOptions {
  store?: FeedbackStore;
  now?: () => Date;
}

export async function handleFeedbackApiRequest(
  request: Request,
  env: FeedbackApiEnv,
  options: HandlerOptions = {},
): Promise<Response> {
  const corsHeaders = createCorsHeaders(request, env);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const store = options.store ?? new D1FeedbackStore(env.DB);
  const now = options.now ?? (() => new Date());

  try {
    if (request.method === "POST" && url.pathname === "/feedback") {
      return await createFeedback(request, env, store, now, corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/feedback") {
      return await listFeedback(request, env, store, corsHeaders);
    }

    const reviewMatch = url.pathname.match(/^\/feedback\/([^/]+)$/);
    if (request.method === "PATCH" && reviewMatch) {
      return await reviewFeedback(request, env, store, reviewMatch[1], now, corsHeaders);
    }

    return json({ error: "Not found." }, 404, corsHeaders);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "feedback_api_error", error: readError(error) }));
    return json({ error: "Feedback API failed." }, 500, corsHeaders);
  }
}

async function createFeedback(
  request: Request,
  env: FeedbackApiEnv,
  store: FeedbackStore,
  now: () => Date,
  headers: HeadersInit,
): Promise<Response> {
  const body = await readBoundedJson(request);
  if (!body.ok) return json({ error: body.error }, 400, headers);

  const submission = validateFeedbackSubmission(body.value);
  if (!submission.ok) return json({ error: submission.error }, 400, headers);

  const record = await store.create(submission.value!, now());
  return json(
    {
      id: record.id,
      reviewUrl: env.REVIEW_BASE_URL ? `${trimTrailingSlash(env.REVIEW_BASE_URL)}/${record.id}` : undefined,
    },
    201,
    headers,
  );
}

async function listFeedback(
  request: Request,
  env: FeedbackApiEnv,
  store: FeedbackStore,
  headers: HeadersInit,
): Promise<Response> {
  if (!(await isModerator(request, env))) return json({ error: "Unauthorized." }, 401, headers);

  const url = new URL(request.url);
  const status = readStatus(url.searchParams.get("status"));
  if (!status) return json({ error: "Status must be pending, approved, denied, or needs_info." }, 400, headers);

  const limit = readLimit(url.searchParams.get("limit"));
  const items = await store.list(status, limit);
  return json({ items }, 200, headers);
}

async function reviewFeedback(
  request: Request,
  env: FeedbackApiEnv,
  store: FeedbackStore,
  id: string,
  now: () => Date,
  headers: HeadersInit,
): Promise<Response> {
  if (!(await isModerator(request, env))) return json({ error: "Unauthorized." }, 401, headers);

  const body = await readBoundedJson(request);
  if (!body.ok) return json({ error: body.error }, 400, headers);

  const decision = validateReviewDecision(body.value);
  if (!decision.ok) return json({ error: decision.error }, 400, headers);

  const record = await store.review(id, decision.value!, now());
  if (!record) return json({ error: "Feedback not found." }, 404, headers);

  return json({ item: record }, 200, headers);
}

async function readBoundedJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return { ok: false, error: "Request body is too large." };
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, error: "Request body is too large." };

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "Request body must be valid JSON." };
  }
}

async function isModerator(request: Request, env: FeedbackApiEnv): Promise<boolean> {
  if (!env.MODERATOR_TOKEN) return false;

  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!provided) return false;

  const encoder = new TextEncoder();
  const [expectedHash, providedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(env.MODERATOR_TOKEN)),
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
  ]);
  return equalBytes(new Uint8Array(expectedHash), new Uint8Array(providedHash));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

function readStatus(value: string | null): FeedbackStatus | null {
  if (!value) return "pending";
  return isFeedbackStatus(value) ? value : null;
}

function readLimit(value: string | null): number {
  const parsed = value ? Number(value) : DEFAULT_QUEUE_LIMIT;
  if (!Number.isFinite(parsed)) return DEFAULT_QUEUE_LIMIT;
  return Math.max(1, Math.min(MAX_QUEUE_LIMIT, Math.floor(parsed)));
}

function createCorsHeaders(request: Request, env: FeedbackApiEnv): HeadersInit {
  const origin = request.headers.get("origin") ?? "*";
  const allowed = (env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes("*") || allowed.includes(origin) ? origin : allowed[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body: Record<string, unknown>, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
