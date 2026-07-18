# Xquik Core Examples

> Complete TypeScript patterns for Xquik REST reads, writes, and webhooks. Recheck the live [OpenAPI document](https://xquik.com/openapi.json) before adopting an endpoint.

## Contents

- [Secret-Backed Request Client](#secret-backed-request-client)
- [Cursor-Safe Post Search](#cursor-safe-post-search)
- [Approval-Gated Write](#approval-gated-write)
- [Webhook Signature Verification](#webhook-signature-verification)

## Secret-Backed Request Client

```typescript
const XQUIK_BASE_URL = "https://xquik.com";
const MAX_ERROR_BODY_LENGTH = 500;

class XquikHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "XquikHttpError";
    this.status = status;
  }
}

function readXquikApiKey(): string {
  const apiKey = process.env.XQUIK_API_KEY;
  if (!apiKey) throw new Error("XQUIK_API_KEY is required.");
  return apiKey;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;

  const message = (await response.text()).slice(0, MAX_ERROR_BODY_LENGTH);
  throw new XquikHttpError(
    response.status,
    message || `Xquik request failed with HTTP ${response.status}.`,
  );
}

async function xquikRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!path.startsWith("/api/v1/")) {
    throw new Error("Xquik REST paths must start with /api/v1/.");
  }

  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("x-api-key", readXquikApiKey());

  const response = await fetch(`${XQUIK_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  return parseJson<T>(response);
}

export { XquikHttpError, xquikRequest };
```

**Why good:** The client rejects unexpected origins, bounds error text, keeps credentials in headers, and preserves caller headers without exposing the key.

## Cursor-Safe Post Search

X data responses use `has_next_page` and `next_cursor`. Cursors are opaque and may lead to an empty page, so continue while the API reports another page and supplies a new cursor.

```typescript
type PublicPost = {
  id?: string;
  text?: string;
  author?: { username?: string };
};

type PostSearchPage = {
  tweets?: PublicPost[];
  has_next_page?: boolean;
  next_cursor?: string;
};

type SearchOptions = {
  maxPages: number;
  pageSize: number;
  query: string;
};

const MAX_PAGE_SIZE = 200;

function validateSearchOptions(options: SearchOptions): void {
  if (!options.query.trim()) throw new Error("Search query is required.");
  if (options.pageSize < 1 || options.pageSize > MAX_PAGE_SIZE) {
    throw new Error(`pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
  }
  if (!Number.isInteger(options.maxPages) || options.maxPages < 1) {
    throw new Error("maxPages must be a positive integer.");
  }
}

async function searchPublicPosts(
  options: SearchOptions,
): Promise<PublicPost[]> {
  validateSearchOptions(options);

  const posts: PublicPost[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let pageIndex = 0; pageIndex < options.maxPages; pageIndex += 1) {
    const params = new URLSearchParams({
      q: options.query,
      queryType: "Latest",
      limit: String(options.pageSize),
    });
    if (cursor) params.set("cursor", cursor);

    const page = await xquikRequest<PostSearchPage>(
      `/api/v1/x/tweets/search?${params}`,
    );
    posts.push(...(page.tweets ?? []));

    if (page.has_next_page !== true) break;
    const nextCursor = page.next_cursor;
    if (!nextCursor || nextCursor === cursor || seenCursors.has(nextCursor)) {
      throw new Error("Xquik pagination did not return a new cursor.");
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return posts;
}

export { searchPublicPosts };
export type { PostSearchPage, PublicPost, SearchOptions };
```

**Why good:** The loop has an explicit page budget, query values are encoded, empty pages do not terminate valid pagination, and repeated cursors fail safely.

## Approval-Gated Write

Pass an approval callback that displays the exact account and payload. A `202` response is pending confirmation, not a completed post.

```typescript
type CreatePostInput = {
  account: string;
  text: string;
};

type CompletedPost = {
  status: "completed";
  tweetId: string;
};

type PendingPost = {
  status: "pending_confirmation";
  writeActionId: string;
};

type CreatePostResult = CompletedPost | PendingPost;

type ApprovalRequest = {
  action: "create_post";
  account: string;
  payload: CreatePostInput;
};

type RequestApproval = (request: ApprovalRequest) => Promise<boolean>;

async function createPost(
  input: CreatePostInput,
  requestApproval: RequestApproval,
): Promise<CreatePostResult> {
  const approved = await requestApproval({
    action: "create_post",
    account: input.account,
    payload: input,
  });
  if (!approved) throw new Error("User declined the X write action.");

  const response = await fetch("https://xquik.com/api/v1/x/tweets", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": readXquikApiKey(),
    },
    body: JSON.stringify(input),
  });

  if (response.status === 202) {
    const pending = (await response.json()) as { writeActionId?: string };
    if (!pending.writeActionId) {
      throw new Error("Pending write response omitted writeActionId.");
    }
    return {
      status: "pending_confirmation",
      writeActionId: pending.writeActionId,
    };
  }

  if (!response.ok) {
    throw new XquikHttpError(response.status, "X write action failed.");
  }

  const completed = (await response.json()) as { tweetId?: string };
  if (!completed.tweetId) {
    throw new Error("Completed write response omitted tweetId.");
  }
  return { status: "completed", tweetId: completed.tweetId };
}

export { createPost };
export type { ApprovalRequest, CreatePostInput, CreatePostResult };
```

**Why good:** The caller owns the visible approval prompt, the required account identifies the write target, and pending confirmation follows a separate state instead of retrying the post.

## Webhook Signature Verification

Xquik signs `<timestamp>.<nonce>.<rawBody>` with HMAC-SHA256. Verify the signature against the exact request bytes before parsing JSON. Store nonce hashes during the replay window in a shared data store when multiple processes receive webhooks.

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

type WebhookEnvelope = {
  nonce: string;
  rawBody: Uint8Array;
  signature: string;
  timestamp: string;
};

const SIGNATURE_PREFIX = "sha256=";
const HEX_DIGEST_LENGTH = 64;

function signatureBytes(value: string): Buffer {
  if (!value.startsWith(SIGNATURE_PREFIX)) {
    throw new Error("Unsupported Xquik signature format.");
  }
  const hex = value.slice(SIGNATURE_PREFIX.length);
  if (hex.length !== HEX_DIGEST_LENGTH || !/^[a-f0-9]+$/i.test(hex)) {
    throw new Error("Invalid Xquik signature digest.");
  }
  return Buffer.from(hex, "hex");
}

function verifyXquikWebhook(envelope: WebhookEnvelope, secret: string): void {
  const prefix = `${envelope.timestamp}.${envelope.nonce}.`;
  const expected = createHmac("sha256", secret)
    .update(prefix, "utf8")
    .update(envelope.rawBody)
    .digest();
  const received = signatureBytes(envelope.signature);

  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new Error("Invalid Xquik webhook signature.");
  }
}

export { verifyXquikWebhook };
export type { WebhookEnvelope };
```

**Why good:** The comparison is constant-time, malformed signatures fail before comparison, and the raw request bytes preserve the signed message exactly.

After cryptographic verification, also reject stale timestamps and previously accepted nonces before applying side effects. Use `deliveryId` or `streamEventId` as an idempotency key for event processing.
