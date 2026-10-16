# AI Reviewing — Reference

> Lookup only. Decisions and red flags are in [SKILL.md](SKILL.md); defect and fix pairs are in [examples/core.md](examples/core.md). Provider values move, so each section names the page it came from — re-check there before quoting a value in a review.

---

## SDK retry and timeout defaults

| Setting             | Anthropic TypeScript SDK                     | OpenAI Node SDK                           |
| ------------------- | -------------------------------------------- | ----------------------------------------- |
| Retries by default  | 2, honouring `retry-after`                   | 2                                         |
| Retried             | connection errors, 408, 409, 429, ≥500       | connection errors, 408, 409, 429, ≥500    |
| Timeout by default  | 10 minutes                                   | 10 minutes                                |
| Timeouts retried    | yes                                          | yes                                       |
| Set on the client   | `new Anthropic({ maxRetries, timeout })`     | `new OpenAI({ maxRetries, timeout })`     |
| Set per request     | `create(params, { maxRetries, timeout })`    | `create(params, { maxRetries, timeout })` |
| Timeout unit        | milliseconds                                 | milliseconds                              |
| Cancel              | `stream.abort()`, or `break` out of the loop | `signal` request option                   |
| Timeout error class | `APIConnectionTimeoutError`                  | `APIConnectionTimeoutError`               |

Both back off exponentially between retries. Anthropic's Python and Ruby SDKs take timeouts in seconds.

The Anthropic TypeScript SDK raises the default timeout, up to 60 minutes, for a non-streaming call with a large `max_tokens`. It also throws before sending a non-streaming request it expects to run past about ten minutes, unless the call streams or sets its own timeout.

A 429 is not always transient. An Anthropic tier spend-cap 429 has no `retry-after` header and keeps failing until access resumes.

Sources: [Anthropic TypeScript SDK](https://platform.claude.com/docs/en/api/sdks/typescript) (Retries, Timeouts, Long requests), [Anthropic API errors](https://platform.claude.com/docs/en/api/errors), [openai-node README](https://github.com/openai/openai-node).

---

## How a response says it is incomplete

**Anthropic Messages API — `stop_reason`:**

| Value           | Meaning                                                      |
| --------------- | ------------------------------------------------------------ |
| `end_turn`      | finished naturally                                           |
| `stop_sequence` | hit a stop sequence the request set                          |
| `max_tokens`    | cut off at `max_tokens` — the content is truncated           |
| `tool_use`      | wants a tool run before it continues                         |
| `pause_turn`    | paused mid-turn and can be resumed                           |
| `refusal`       | declined, with HTTP 200; `stop_details` carries the category |

A streamed response can also end in an `event: error` (for example `overloaded_error`) after the 200, where a non-streaming call would have returned a 529.

**OpenAI Chat Completions — `finish_reason`:** `stop` (natural end or stop sequence), `length` (token limit — truncated), `tool_calls`, `content_filter` (content omitted by a filter), and the deprecated `function_call`. With Structured Outputs, a refusal arrives in a `refusal` field rather than as schema-shaped content.

**OpenAI Responses API:** a truncated response has `status: "incomplete"` with `incomplete_details.reason: "max_output_tokens"`; a refusal arrives as a refusal content item.

Sources: [Anthropic streaming](https://platform.claude.com/docs/en/build-with-claude/streaming) (Error events), [OpenAI Chat Completions reference](https://developers.openai.com/api/docs/api-reference/chat), [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

---

## Structured-output mechanisms

| Provider and API        | Mechanism          | Request shape                                                     |
| ----------------------- | ------------------ | ----------------------------------------------------------------- |
| Anthropic Messages      | Structured outputs | `output_config: { format: { type: "json_schema", schema } }`      |
| Anthropic Messages      | Strict tool use    | `strict: true` on the tool definition                             |
| OpenAI Responses        | Structured Outputs | `text: { format: { type: "json_schema", strict: true, schema } }` |
| OpenAI Chat Completions | Structured Outputs | `response_format: { type: "json_schema", ... }`                   |
| OpenAI                  | JSON mode          | valid JSON without schema adherence                               |

Anthropic's older `output_format` parameter is deprecated, and a strict tool's schema needs `additionalProperties: false` and `required`. OpenAI recommends Structured Outputs over JSON mode wherever both are available.

A constrained mode still needs validation on receipt. A truncated or refused response may not match the schema; Anthropic's mode rejects numeric ranges and string lengths in a schema with a 400, so those checks belong to the validator; and a schema-valid record can carry a hallucinated value.

Sources: [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Anthropic strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use), [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

---

## Sampling parameters

**Anthropic.** Claude Opus 5.5 rejects any non-default `temperature`, `top_p` or `top_k` with a 400, and so do the other current models and the generations back to Claude Opus 4.7. Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 and earlier still accept them. Each model's migration guide states its own rule.

**OpenAI.** Reasoning models (the o-series and the GPT-5 family) accept only the default `temperature` or reject the parameter outright. The fix is to omit it.

**Neither buys determinism.** At temperature 0, one measured run of 1,000 identical requests returned 80 distinct completions, because inference batches vary in size with server load.

Sources: [Claude Opus 5.5 migration guide](https://platform.claude.com/docs/en/models/opus-5-5/migration-guide), [OpenAI community: o3-mini unsupported `temperature`](https://community.openai.com/t/o3-mini-unsupported-parameter-temperature/1140846), [NeMo Guardrails: OpenAI reasoning models](https://docs.nvidia.com/nemo/guardrails/guardrails-python-sdk/nemoguardrails/llm/openai_reasoning.md), [Thinking Machines: Defeating nondeterminism in LLM inference](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/).

---

## Model ids

Every Claude model id is a pinned snapshot, including the dateless ids used from the 4.6 generation on (`claude-opus-5-5`). Before 4.6, the alias (`claude-opus-4-5`) is a convenience pointer to a dated id (`claude-opus-4-5-20251101`). On a provider whose alias can move to a newer snapshot, the dated id is the pinned one.

The tokenizer introduced with Claude Opus 4.7 fits about 555k words in 1M tokens, where earlier models fit about 750k — up to 1.35× as many tokens for the same text.

Source: [Anthropic models overview](https://platform.claude.com/docs/en/about-claude/models/overview).

---

## History trimming

- **A tool result must immediately follow its tool call.** Anthropic rejects a history that breaks the pairing, which is what a front-trimming `slice` that keeps a `tool_result` and drops its `tool_use` produces.
- **Anthropic's prompt cache is a prefix match.** Trimming the front of a history changes the prefix of every later turn, so the cached history misses.
- **Current Claude models bind replayed thinking blocks to the history before them.** On Claude Fable 5.1, Opus 5.5, Sonnet 5.5 and Haiku 5.5, a replayed block is accepted only while the system prompt, tools and earlier messages are unchanged. For accounts created on or after 31 August 2026, an edited prefix returns a 400 unless the request opts into dropping the block. Keeping history append-only, or using the provider's compaction, avoids both effects.

Sources: [Anthropic: handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls), [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [Anthropic API errors](https://platform.claude.com/docs/en/api/errors) (Thinking block no longer matches the conversation).

---

## Keys and logging

- **Both TypeScript SDKs refuse to run in a browser** unless `dangerouslyAllowBrowser: true` is set, because the key would ship to every visitor.
- **The Anthropic TypeScript SDK logs request and response bodies at the `debug` level**, set by `logLevel` or the `ANTHROPIC_LOG` environment variable. That is a debugging setting, not a deployed one.

Sources: [Anthropic TypeScript SDK](https://platform.claude.com/docs/en/api/sdks/typescript) (Requirements, Logging), [openai-node README](https://github.com/openai/openai-node).

---

## External references by finding class

- Direct and indirect prompt injection — [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- Unvalidated output reaching a sink — [OWASP LLM05:2025 Improper Output Handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/)
- Secrets or access rules in the system prompt — [OWASP LLM07:2025 System Prompt Leakage](https://genai.owasp.org/llmrisk/llm072025-system-prompt-leakage/)
- Unbounded loops, context and spend — [OWASP LLM10:2025 Unbounded Consumption](https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/)
- Why delimiting lowers injection without stopping it — [OpenAI: safety in building agents](https://developers.openai.com/api/docs/guides/agent-builder-safety), [The lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
- Private data, untrusted input and an outbound or mutating tool in one path — [OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) (least functionality and permission, human approval for high-impact actions), [The lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) (an image to load or a link to click is an outbound channel; avoid the combination), [OpenAI: safety in building agents](https://developers.openai.com/api/docs/guides/agent-builder-safety) (tool approvals)
