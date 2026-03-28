# Promptfoo Quick Reference

> CLI commands, assertion type table, provider IDs, red team plugins, and configuration keys. See [SKILL.md](SKILL.md) for core patterns and [examples/](examples/) for code examples.

---

## Installation

```bash
# Run directly (no install)
npx promptfoo@latest eval

# Global install
npm install -g promptfoo

# Project dependency
npm install --save-dev promptfoo
```

---

## CLI Commands

| Command                                 | Description                                 |
| --------------------------------------- | ------------------------------------------- |
| `promptfoo init`                        | Create a new promptfooconfig.yaml           |
| `promptfoo eval`                        | Run evaluation (exits 100 on test failures) |
| `promptfoo eval -c path/to/config.yaml` | Use specific config file                    |
| `promptfoo eval --no-cache`             | Skip cache, force fresh LLM calls           |
| `promptfoo eval -o results.json`        | Output results to file                      |
| `promptfoo eval --share`                | Generate shareable URL                      |
| `promptfoo view`                        | Open results web UI                         |
| `promptfoo share`                       | Share most recent results                   |
| `promptfoo cache clear`                 | Clear cached LLM responses                  |
| `promptfoo redteam run`                 | Run red team security scan                  |
| `promptfoo redteam generate`            | Generate red team test cases only           |
| `promptfoo redteam report`              | View red team results                       |

### Common Flags

| Flag                      | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `-c, --config`            | Path to config file (default: `promptfooconfig.yaml`) |
| `-o, --output`            | Output file path (supports `.json`, `.html`, `.xml`)  |
| `--no-cache`              | Disable response caching                              |
| `--share`                 | Upload results and print shareable URL                |
| `-j, --max-concurrency`   | Max parallel provider calls                           |
| `--table-cell-max-length` | Max chars in table output cells                       |
| `--env-file`              | Path to `.env` file for API keys                      |

---

## Configuration Keys

### Top-Level

```yaml
description: string # Project description
prompts: string[] | object[] # Prompt templates
providers: string[] | object[] # LLM providers
tests: object[] | string # Test cases (inline or file://)
defaultTest: object # Default vars/assertions for all tests
outputPath: string # Results output path
sharing: boolean | object # Enable sharing
```

### Provider Object

```yaml
providers:
  - id: openai:gpt-4o # Provider identifier
    label: "GPT-4o" # Display name in results
    config:
      temperature: 0.7
      max_tokens: 1000
      top_p: 1
```

### Test Object

```yaml
tests:
  - description: "Test name" # Optional label
    vars: # Template variables
      input: "Hello"
    assert: # Assertions array
      - type: contains
        value: "hello"
    options:
      transform: "output.trim()" # Pre-process output
      provider: openai:gpt-4o # Override provider for this test
```

### Default Test

```yaml
defaultTest:
  vars:
    system_prompt: "You are a helpful assistant"
  assert:
    - type: not-contains
      value: "I cannot"
  options:
    provider: openai:gpt-4o
```

---

## Assertion Types

### Deterministic

| Type                            | Value    | Description                    |
| ------------------------------- | -------- | ------------------------------ |
| `equals`                        | string   | Exact match                    |
| `contains`                      | string   | Substring match                |
| `icontains`                     | string   | Case-insensitive substring     |
| `not-contains`                  | string   | Must not contain               |
| `not-equals`                    | string   | Must not equal                 |
| `contains-any`                  | string[] | Contains at least one          |
| `contains-all`                  | string[] | Contains all                   |
| `icontains-any`                 | string[] | Case-insensitive, at least one |
| `icontains-all`                 | string[] | Case-insensitive, all          |
| `starts-with`                   | string   | Prefix match                   |
| `regex`                         | string   | Regular expression match       |
| `not-regex`                     | string   | Must not match regex           |
| `is-json`                       | --       | Valid JSON                     |
| `contains-json`                 | --       | Contains valid JSON            |
| `is-html`                       | --       | Valid HTML                     |
| `is-xml`                        | --       | Valid XML                      |
| `is-sql`                        | --       | Valid SQL                      |
| `is-valid-openai-tools-call`    | --       | Valid OpenAI tools call        |
| `is-valid-openai-function-call` | --       | Valid OpenAI function call     |
| `is-refusal`                    | --       | Model refused to answer        |

### Performance

| Type         | Threshold    | Description          |
| ------------ | ------------ | -------------------- |
| `cost`       | number (USD) | Max cost per call    |
| `latency`    | number (ms)  | Max response time    |
| `perplexity` | number       | Max perplexity score |

### Text Similarity

| Type          | Threshold          | Description                      |
| ------------- | ------------------ | -------------------------------- |
| `levenshtein` | number (max edits) | Edit distance                    |
| `similar`     | number (0-1)       | Cosine similarity via embeddings |
| `rouge-n`     | number (0-1)       | ROUGE-N overlap score            |
| `bleu`        | number (0-1)       | BLEU translation score           |

### Model-Graded

| Type                    | Value           | Description                       |
| ----------------------- | --------------- | --------------------------------- |
| `llm-rubric`            | criteria string | General LLM-as-judge              |
| `factuality`            | ground truth    | Factual accuracy check            |
| `model-graded-closedqa` | ground truth    | Closed-domain QA accuracy         |
| `answer-relevance`      | --              | Answer relevance to question      |
| `context-faithfulness`  | --              | RAG: answer faithful to context   |
| `context-recall`        | --              | RAG: context covers ground truth  |
| `context-relevance`     | --              | RAG: context relevant to question |
| `classifier`            | criteria        | Classification evaluation         |
| `select-best`           | --              | Pick best output across providers |

### Custom

| Type         | Value             | Description                  |
| ------------ | ----------------- | ---------------------------- |
| `javascript` | code or `file://` | Custom JS assertion          |
| `python`     | code or `file://` | Custom Python assertion      |
| `webhook`    | URL               | External validation endpoint |

### Assertion Properties

```yaml
assert:
  - type: llm-rubric
    value: "criteria" # Expected value / criteria
    threshold: 0.8 # Pass/fail threshold (0-1)
    weight: 2.0 # Scoring weight in results UI
    metric: "quality" # Label for UI aggregation
    provider: openai:gpt-4o # Grading model (model-graded only)
    transform: "output.trim()" # Pre-process output before assertion
```

---

## Built-in Provider IDs

### OpenAI

```
openai:gpt-4o
openai:gpt-4o-mini
openai:o4-mini
openai:gpt-4.1
openai:gpt-4.1-mini
```

### Anthropic

```
anthropic:messages:claude-sonnet-4-6
anthropic:messages:claude-opus-4-6
anthropic:messages:claude-sonnet-4-5-latest
anthropic:messages:claude-3-5-haiku-latest
```

### Google

```
vertex:gemini-2.0-flash
vertex:gemini-2.5-pro
```

### Other

```
ollama:llama3
ollama:mistral
huggingface:text-generation:MODEL_NAME
```

### Custom

```yaml
# TypeScript/JavaScript file
- file://providers/my-provider.ts

# HTTP endpoint
- id: https://api.example.com/chat
  config:
    method: POST
    headers:
      Authorization: "Bearer {{env.API_KEY}}"
    body:
      prompt: "{{prompt}}"
```

---

## Red Team Configuration

### Plugins (Attack Generators)

| Plugin                   | Category       | Description                  |
| ------------------------ | -------------- | ---------------------------- |
| `harmful`                | Criminal       | Harmful content generation   |
| `pii`                    | Privacy        | PII extraction attempts      |
| `prompt-extraction`      | Security       | System prompt extraction     |
| `hallucination`          | Misinformation | Hallucinated information     |
| `contracts`              | Misinformation | Unauthorized commitments     |
| `excessive-agency`       | Misinformation | Taking unauthorized actions  |
| `competitor-endorsement` | Misinformation | Endorsing competitors        |
| `hijacking`              | Security       | Topic/task hijacking         |
| `overreliance`           | Misinformation | Over-reliance on user claims |
| `shell-injection`        | Security       | OS command injection         |
| `sql-injection`          | Security       | SQL injection attempts       |

### Strategies (Delivery Methods)

| Strategy           | Description                |
| ------------------ | -------------------------- |
| `jailbreak`        | Jailbreak prompt templates |
| `prompt-injection` | Direct prompt injection    |
| `crescendo`        | Multi-turn escalation      |
| `goat`             | Generative offensive agent |
| `base64`           | Base64-encoded payloads    |
| `rot13`            | ROT13-encoded payloads     |
| `leetspeak`        | Leetspeak encoding         |
| `iterative`        | Iterative refinement       |

### Presets

```yaml
redteam:
  plugins:
    - owasp:llm:01 # OWASP LLM Top 10
    - nist:ai:measure # NIST AI RMF
```

---

## Environment Variables

| Variable                    | Purpose                          |
| --------------------------- | -------------------------------- |
| `OPENAI_API_KEY`            | OpenAI provider API key          |
| `ANTHROPIC_API_KEY`         | Anthropic provider API key       |
| `GOOGLE_API_KEY`            | Google / Vertex AI API key       |
| `PROMPTFOO_CONFIG`          | Override config file path        |
| `PROMPTFOO_CACHE_PATH`      | Custom cache directory           |
| `PROMPTFOO_DISABLE_CACHE`   | Disable caching (`1` to disable) |
| `PROMPTFOO_SHARING_APP_URL` | Custom sharing server URL        |

---

## Nunjucks Template Syntax

```yaml
# Variable substitution
prompts:
  - "Translate to {{language}}: {{input}}"

  # Conditional
  - "{% if context %}Context: {{context}}{% endif %}\n{{question}}"

  # Loop
  - "{% for item in items %}{{item}}\n{% endfor %}"

  # Environment variable
  - "file://{{ env.PROMPT_DIR }}/prompt.txt"
```

> For YAML references (reusable assertion blocks), see [examples/core.md](examples/core.md#yaml-references-reusable-assertions).
