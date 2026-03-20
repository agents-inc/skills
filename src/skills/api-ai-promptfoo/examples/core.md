# Promptfoo -- Config & Assertions Examples

> Core configuration patterns, prompt definitions, provider setup, test cases, and assertion types. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [model-graded.md](model-graded.md) -- LLM-as-judge assertions, factuality, context evaluation
- [red-teaming.md](red-teaming.md) -- Security scanning, plugins, strategies
- [custom-providers.md](custom-providers.md) -- TypeScript providers, programmatic API, CI/CD

---

## Minimal Configuration

```yaml
# promptfooconfig.yaml
prompts:
  - "Answer this question: {{question}}"

providers:
  - openai:gpt-4o

tests:
  - vars:
      question: "What is 2 + 2?"
    assert:
      - type: contains
        value: "4"
```

---

## Multi-Provider Comparison

```yaml
# promptfooconfig.yaml
description: "Compare models for customer support"

prompts:
  - file://prompts/support-agent.txt

providers:
  - id: openai:gpt-4o
    label: "GPT-4o"
    config:
      temperature: 0.3
  - id: anthropic:messages:claude-sonnet-4-6
    label: "Claude Sonnet"
    config:
      temperature: 0.3
  - id: openai:gpt-4.1-mini
    label: "GPT-4.1 Mini"
    config:
      temperature: 0.3

tests:
  - vars:
      customer_query: "I want to return my order"
    assert:
      - type: llm-rubric
        value: "Response is empathetic, offers clear return instructions, and asks for order number"
      - type: not-contains
        value: "I cannot"
      - type: latency
        threshold: 3000
      - type: cost
        threshold: 0.05
```

---

## Prompts From Files

```yaml
# promptfooconfig.yaml
prompts:
  # Plain text file with Nunjucks variables
  - file://prompts/chat.txt

  # JSON messages array (Chat Completions format)
  - file://prompts/chat.json

  # Multiple prompt variants to compare
  - file://prompts/v1-concise.txt
  - file://prompts/v2-detailed.txt
```

```text
# prompts/chat.txt
You are a helpful customer support agent for {{company_name}}.
Answer the following question: {{question}}
Be concise and friendly.
```

```json
// prompts/chat.json
[
  {
    "role": "system",
    "content": "You are a helpful assistant for {{company_name}}."
  },
  { "role": "user", "content": "{{question}}" }
]
```

---

## Test Cases From Files

```yaml
# promptfooconfig.yaml
prompts:
  - "Translate to {{language}}: {{input}}"

providers:
  - openai:gpt-4o

# Load tests from external files
tests:
  - file://tests/translation-tests.yaml
  - file://tests/edge-cases.yaml

# Or from CSV
tests: file://tests/cases.csv
```

```yaml
# tests/translation-tests.yaml
- vars:
    language: French
    input: "Hello world"
  assert:
    - type: icontains
      value: "bonjour"
    - type: llm-rubric
      value: "Natural French translation"

- vars:
    language: Spanish
    input: "Good morning"
  assert:
    - type: icontains
      value: "buenos"
```

```csv
# tests/cases.csv -- column headers become variable names
language,input,__expected
French,Hello world,bonjour
Spanish,Good morning,buenos
German,Thank you,danke
```

---

## Default Test (Shared Assertions)

```yaml
# promptfooconfig.yaml
# defaultTest applies to ALL test cases
defaultTest:
  vars:
    system_prompt: "You are a helpful coding assistant."
  assert:
    # These assertions run on every test
    - type: not-contains
      value: "I'm just an AI"
    - type: cost
      threshold: 0.05
    - type: latency
      threshold: 5000

tests:
  - vars:
      question: "Explain async/await"
    assert:
      # These run IN ADDITION to defaultTest assertions
      - type: icontains
        value: "await"

  - vars:
      question: "What is a closure?"
    assert:
      - type: llm-rubric
        value: "Explains closures with a practical example"
```

---

## All Deterministic Assertion Types

### String Matching

```yaml
assert:
  # Exact match
  - type: equals
    value: "Hello, World!"

  # Substring (case-sensitive)
  - type: contains
    value: "Hello"

  # Substring (case-insensitive)
  - type: icontains
    value: "hello"

  # Must NOT contain
  - type: not-contains
    value: "error"

  # Must NOT equal
  - type: not-equals
    value: "I don't know"

  # Starts with prefix
  - type: starts-with
    value: "Sure"

  # Contains at least one of these
  - type: contains-any
    value:
      - "option A"
      - "option B"
      - "option C"

  # Contains ALL of these
  - type: contains-all
    value:
      - "step 1"
      - "step 2"
      - "step 3"

  # Regex match
  - type: regex
    value: "\\d{3}-\\d{3}-\\d{4}" # phone number pattern

  # Must NOT match regex
  - type: not-regex
    value: "(?i)error|fail|exception"
```

### Structured Output

```yaml
assert:
  # Output is valid JSON
  - type: is-json

  # Output contains valid JSON (may have surrounding text)
  - type: contains-json

  # Output is valid HTML
  - type: is-html

  # Output is valid XML
  - type: is-xml

  # Output is valid SQL
  - type: is-sql

  # Valid OpenAI function call format
  - type: is-valid-openai-function-call

  # Valid OpenAI tools call format
  - type: is-valid-openai-tools-call

  # Model refused to answer
  - type: is-refusal
```

### Performance & Cost

```yaml
assert:
  # Response cost under budget
  - type: cost
    threshold: 0.01 # max $0.01 per call

  # Response time under limit
  - type: latency
    threshold: 2000 # max 2 seconds (milliseconds)

  # Perplexity score
  - type: perplexity
    threshold: 50
```

### Text Similarity

```yaml
assert:
  # Edit distance (Levenshtein)
  - type: levenshtein
    value: "expected output text"
    threshold: 5 # max 5 character edits

  # ROUGE-N overlap
  - type: rouge-n
    value: "reference text for comparison"
    threshold: 0.7

  # BLEU score
  - type: bleu
    value: "reference translation"
    threshold: 0.5
```

---

## Transform (Pre-Process Output)

````yaml
tests:
  - vars:
      input: "Generate a JSON report"
    options:
      # Extract JSON from markdown code blocks before assertions run
      transform: |
        const match = output.match(/```json\n([\s\S]*?)\n```/);
        return match ? match[1] : output;
    assert:
      - type: is-json
````

---

## Assertion Sets (Partial Pass)

```yaml
assert:
  # At least 2 out of 3 assertions must pass
  - type: assert-set
    threshold: 0.67
    assert:
      - type: icontains
        value: "hello"
      - type: icontains
        value: "bonjour"
      - type: icontains
        value: "hola"
```

---

## Weighted Assertions

```yaml
assert:
  # Accuracy is more important than speed
  - type: llm-rubric
    value: "Response is factually correct"
    weight: 3.0
    metric: "accuracy"

  - type: latency
    threshold: 3000
    weight: 1.0
    metric: "speed"

  - type: cost
    threshold: 0.02
    weight: 1.0
    metric: "cost"
```

---

## YAML References (Reusable Assertions)

```yaml
# Define reusable assertion templates
assertionTemplates:
  qualityCheck:
    type: llm-rubric
    value: "Response is helpful, accurate, and professionally written"
  noHallucination:
    type: not-contains
    value: "I'm not sure but"
  budgetCheck:
    type: cost
    threshold: 0.02

tests:
  - vars:
      question: "What is TypeScript?"
    assert:
      - $ref: "#/assertionTemplates/qualityCheck"
      - $ref: "#/assertionTemplates/noHallucination"
      - $ref: "#/assertionTemplates/budgetCheck"

  - vars:
      question: "Explain React hooks"
    assert:
      - $ref: "#/assertionTemplates/qualityCheck"
      - $ref: "#/assertionTemplates/budgetCheck"
```

---

## Variable Types

```yaml
tests:
  # Simple string
  - vars:
      question: "What is TypeScript?"

  # File content as variable
  - vars:
      context: file://data/context.txt
      question: "Summarize the above"

  # Array (creates one test per value)
  - vars:
      language:
        - French
        - Spanish
        - German
      input: "Hello world"

  # Nested object
  - vars:
      user:
        name: "Alice"
        role: "admin"
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
