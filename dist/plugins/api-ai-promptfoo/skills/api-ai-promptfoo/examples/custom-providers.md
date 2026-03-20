# Promptfoo -- Custom Providers & Programmatic API Examples

> TypeScript custom providers, inline function providers, programmatic evaluation, and CI/CD integration patterns. See [core.md](core.md) for basic configuration.

**Related examples:**

- [core.md](core.md) -- Config structure, assertions
- [model-graded.md](model-graded.md) -- Model-graded assertions
- [red-teaming.md](red-teaming.md) -- Security scanning

---

## TypeScript Custom Provider

Use when your LLM integration involves custom logic (RAG, agents, middleware).

```typescript
// providers/rag-provider.ts
import type {
  ApiProvider,
  ProviderOptions,
  ProviderResponse,
  CallApiContextParams,
} from "promptfoo";

// NOTE: default export required by promptfoo's file:// provider loader
export default class RagProvider implements ApiProvider {
  private config: Record<string, unknown>;

  constructor(options: ProviderOptions) {
    this.config = options.config || {};
  }

  id(): string {
    return "rag-provider";
  }

  async callApi(
    prompt: string,
    context?: CallApiContextParams,
  ): Promise<ProviderResponse> {
    // 1. Retrieve relevant documents
    const docs = await retrieveDocuments(prompt);

    // 2. Build augmented prompt
    const augmentedPrompt = `Context:\n${docs.join("\n")}\n\nQuestion: ${prompt}`;

    // 3. Call LLM
    const response = await callLLM(augmentedPrompt);

    return {
      output: response.text,
      tokenUsage: {
        total: response.totalTokens,
        prompt: response.promptTokens,
        completion: response.completionTokens,
      },
      cost: response.cost,
      metadata: {
        docsRetrieved: docs.length,
        retrievalLatencyMs: response.retrievalTime,
      },
    };
  }
}
```

```yaml
# promptfooconfig.yaml
prompts:
  - "{{question}}"

providers:
  - file://providers/rag-provider.ts

tests:
  - vars:
      question: "What is our refund policy?"
    assert:
      - type: context-faithfulness
        threshold: 0.9
        provider: openai:gpt-4o
      - type: icontains
        value: "30 days"
```

---

## Provider With Config From YAML

Pass configuration from YAML to your TypeScript provider.

```yaml
# promptfooconfig.yaml
providers:
  - id: file://providers/rag-provider.ts
    label: "RAG (top-3)"
    config:
      topK: 3
      temperature: 0.2
      maxTokens: 500

  - id: file://providers/rag-provider.ts
    label: "RAG (top-5)"
    config:
      topK: 5
      temperature: 0.2
      maxTokens: 500
```

```typescript
// providers/rag-provider.ts
// NOTE: default export required by promptfoo's file:// provider loader
export default class RagProvider implements ApiProvider {
  private topK: number;

  constructor(options: ProviderOptions) {
    this.topK = (options.config?.topK as number) || 3;
  }

  // ...use this.topK in callApi
}
```

---

## Inline Function Provider

For simple cases, define the provider inline without a separate file.

```typescript
// eval.ts
import promptfoo from "promptfoo";

const results = await promptfoo.evaluate({
  prompts: ["Summarize: {{text}}"],
  providers: [
    // Inline provider function
    async (prompt: string, context) => {
      const response = await fetch("https://api.myapp.com/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt }),
      });
      const data = await response.json();
      return { output: data.summary };
    },
  ],
  tests: [
    {
      vars: { text: "A long article about climate change..." },
      assert: [{ type: "llm-rubric", value: "Concise and accurate summary" }],
    },
  ],
});
```

---

## Programmatic API (evaluate)

Run evaluations from TypeScript code. Useful for integration tests or scheduled jobs.

```typescript
// scripts/run-eval.ts
import promptfoo from "promptfoo";
import type { EvaluateSummary } from "promptfoo";

const MAX_CONCURRENCY = 5;

const results: EvaluateSummary = await promptfoo.evaluate(
  {
    prompts: [
      "Translate to {{language}}: {{text}}",
      "You are a translator. Convert this to {{language}}: {{text}}",
    ],
    providers: ["openai:gpt-4o", "anthropic:messages:claude-sonnet-4-6"],
    tests: [
      {
        vars: { language: "French", text: "Hello world" },
        assert: [
          { type: "icontains", value: "bonjour" },
          { type: "cost", threshold: 0.01 },
        ],
      },
      {
        vars: { language: "Spanish", text: "Good morning" },
        assert: [
          { type: "icontains", value: "buenos" },
          {
            type: "llm-rubric",
            value: "Natural translation, not word-for-word",
          },
        ],
      },
    ],
    writeLatestResults: true,
    sharing: true,
  },
  { maxConcurrency: MAX_CONCURRENCY },
);

// Access results
const totalTests = results.stats.successes + results.stats.failures;
console.log("Total tests:", totalTests);
console.log("Pass rate:", results.stats.successes / totalTests);
if (results.shareableUrl) {
  console.log("Results:", results.shareableUrl);
}
```

---

## CI/CD: GitHub Actions Workflow

```yaml
# .github/workflows/llm-eval.yml
name: LLM Evaluation
on:
  pull_request:
    paths:
      - "prompts/**"
      - "promptfooconfig.yaml"
      - "src/ai/**"

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"

      # Cache LLM responses to save cost
      - uses: actions/cache@v4
        with:
          path: ~/.cache/promptfoo
          key: ${{ runner.os }}-promptfoo-v1
          restore-keys: |
            ${{ runner.os }}-promptfoo-

      - name: Run LLM evaluation
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npx promptfoo@latest eval \
            --fail-on-error \
            -o results.json \
            -o report.html \
            --share

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: llm-eval-report
          path: report.html
```

---

## CI/CD: Using promptfoo-action

```yaml
# .github/workflows/llm-eval.yml
name: Prompt Evaluation
on:
  pull_request:
    paths:
      - "prompts/**"

jobs:
  evaluate:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/cache@v4
        with:
          path: ~/.cache/promptfoo
          key: ${{ runner.os }}-promptfoo-v1

      - uses: promptfoo/promptfoo-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          prompts: "prompts/**/*.json"
          config: "promptfooconfig.yaml"
          cache-path: ~/.cache/promptfoo
```

---

## CI/CD: npm Script With Quality Gate

```json
// package.json
{
  "scripts": {
    "test:llm": "promptfoo eval --fail-on-error",
    "test:llm:view": "promptfoo view",
    "test:llm:redteam": "promptfoo redteam run --fail-on-error",
    "test:llm:share": "promptfoo eval --share"
  }
}
```

```bash
# Quality gate with pass rate threshold
RESULTS=$(npx promptfoo@latest eval -o results.json --fail-on-error 2>&1)
PASS_RATE=$(jq '.results.stats.successes / (.results.stats.successes + .results.stats.failures) * 100' results.json)

MIN_PASS_RATE=95
if (( $(echo "$PASS_RATE < $MIN_PASS_RATE" | bc -l) )); then
  echo "Quality gate failed: ${PASS_RATE}% < ${MIN_PASS_RATE}%"
  exit 1
fi
echo "Quality gate passed: ${PASS_RATE}%"
```

---

## HTTP Provider (No Code)

Test any HTTP endpoint without writing a custom provider.

```yaml
# promptfooconfig.yaml
providers:
  - id: https://api.myapp.com/chat
    label: "My App API"
    config:
      method: POST
      headers:
        Authorization: "Bearer {{env.APP_API_KEY}}"
        Content-Type: "application/json"
      body:
        message: "{{prompt}}"
        user_id: "eval-user"
      responseParser: "json.choices[0].message.content"

tests:
  - vars:
      input: "What are your business hours?"
    assert:
      - type: icontains
        value: "9"
      - type: llm-rubric
        value: "Provides specific business hours"
```

---

## Sharing Results

```bash
# Share after eval
npx promptfoo@latest eval --share

# Share most recent results
npx promptfoo@latest share

# Output to file for archival
npx promptfoo@latest eval -o results.json -o report.html
```

---

## Cache Management

```bash
# Clear all cached responses
npx promptfoo@latest cache clear

# Run without cache (fresh LLM calls)
npx promptfoo@latest eval --no-cache

# Disable cache via env
PROMPTFOO_DISABLE_CACHE=1 npx promptfoo@latest eval
```

---

_For basic configuration, see [core.md](core.md). For API reference, see [reference.md](../reference.md)._
