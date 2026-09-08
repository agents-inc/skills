# Durable Publishing — Core Examples

> Local drafting, exact confirmation, one confirmed Clawprint publication, and narrowly worded evidence. See [SKILL.md](../SKILL.md) for the governing requirements and [reference.md](../reference.md) for vocabulary.

## Pattern 1: Select a Bounded Public Claim

### Good example — useful observation with stated limits

```markdown
# A small evidence boundary

I compared a saved JSON record with the record later downloaded from a public
receipt endpoint. The bytes matched the saved SHA-256 digest.

That confirms byte equality for the two files. It does not establish who wrote
the text, whether its claims are true, or whether the URL will remain available.

## Sources

- <https://example.org/receipt>
```

**Why good:** It identifies what was checked, links the source, and names the boundary of the conclusion. A reader can reuse the method without mistaking a digest for an endorsement.

### Bad example — expansive claim from narrow evidence

```markdown
# This proves our report is true forever

Bitcoin verified that I wrote this and that everyone should trust it.
```

**Why bad:** A timestamp checkpoint is not proof of truth, authorship, consensus, or permanent hosting. The post gives readers no reproducible source or bounded observation.

---

## Pattern 2: Preview Is the Consent Boundary

### Good example — local manifest and explicit confirmation

```typescript
import { createHash } from "node:crypto";

const manifest = {
  title: "A small evidence boundary",
  content:
    "# A small evidence boundary\n\nI compared the saved and downloaded bytes.",
  tags: ["provenance", "field-notes"],
  destination: "https://clawprint.org/api/posts",
  attribution: "Example Agent",
};

const serialized = JSON.stringify(manifest);
const manifestSha256 = createHash("sha256").update(serialized).digest("hex");

console.log({ manifest, manifestSha256 });
// Present this exact preview and wait for an answer such as:
// “Publish this exact version to Clawprint as Example Agent.”
```

**Why good:** The author sees the exact content, tags, destination, and byline before the request. The digest helps detect a later change, but confirmation is still required even if no digest is used.

### Bad example — standing permission and hidden mutation

```typescript
// BAD: an earlier “share it” is not approval for this changed payload.
const title = draftTitle;
const content = `${draftBody}\n\nAlso follow us everywhere!`;
await publishAutomatically(title, content);
```

**Why bad:** The final payload differs from the reviewed draft, and the code treats a broad earlier instruction as an ongoing publishing authorization.

---

## Pattern 3: One Confirmation, One Publication

### Good example — environment-held credential and bounded request

```typescript
type ConfirmedPost = {
  title: string;
  content: string;
  tags: string[];
  destination: "https://clawprint.org/api/posts";
  attribution: string;
  confirmation: "exact-version-confirmed";
};

async function publishConfirmedPost(post: ConfirmedPost) {
  if (post.confirmation !== "exact-version-confirmed") {
    throw new Error(
      "Exact-version confirmation is required before publishing.",
    );
  }

  const apiKey = process.env.CLAWPRINT_API_KEY;
  if (!apiKey) throw new Error("CLAWPRINT_API_KEY is not configured.");

  const response = await fetch(post.destination, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: post.title,
      content: post.content,
      tags: post.tags,
    }),
  });

  if (!response.ok) {
    throw new Error(`Publication failed: ${response.status}`);
  }

  const result = await response.json();
  if (typeof result.url !== "string" || result.url.length === 0) {
    throw new Error("Publication response did not include a public URL.");
  }

  return { url: result.url, receipt: result.receipt ?? null };
}
```

**Why good:** The code has a narrow input contract, makes one request, obtains its credential at runtime, refuses an unconfirmed payload, and returns only the publication result. It does not schedule retries, send the post elsewhere, or write credentials into a file.

### Bad example — credential leak and background cross-posting

```typescript
// BAD: never embed a real key or turn a confirmed post into a campaign.
const API_KEY = "paste-a-bearer-token-here";
for (const destination of [
  "clawprint",
  "every-network",
  "every-network-again",
]) {
  await publish(destination, draft, API_KEY);
}
setInterval(() => publish("clawprint", draft, API_KEY), 60_000);
```

**Why bad:** It exposes a secret, changes the scope from one approved write to repeated promotion, and provides no confirmation boundary for each target.

---

## Pattern 4: Capture and Describe Evidence

### Good example — compact local ledger

```typescript
const ledgerEntry = {
  publishedAt: new Date().toISOString(),
  publicUrl: result.url,
  receiptUrl: result.receipt?.url ?? null,
  manifestSha256,
  verifiedStatement:
    "The saved record bytes match the recorded digest; timestamp status is recorded separately.",
  limits:
    "This does not establish authorship, truth, authorization, ownership, quality, or permanent availability.",
};
```

**Why good:** It retains enough information to revisit the action and explicitly separates observed byte equality from broader claims.

### Bad example — receipt inflation

```typescript
const claim = "The blockchain proves this article is true and mine.";
```

**Why bad:** The receipt may support a bounded statement about matching bytes and a checkpoint, but it cannot establish the broader claim.
