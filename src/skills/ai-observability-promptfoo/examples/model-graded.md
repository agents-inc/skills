# Promptfoo -- Model-Graded & Advanced Assertions Examples

> LLM-as-judge evaluation, factuality checks, semantic similarity, RAG context evaluation, and custom grading. See [core.md](core.md) for basic assertions.

**Related examples:**

- [core.md](core.md) -- Config structure, deterministic assertions
- [red-teaming.md](red-teaming.md) -- Security scanning
- [custom-providers.md](custom-providers.md) -- TypeScript providers, programmatic API

---

## llm-rubric (General Quality)

The most versatile model-graded assertion. Evaluates output against arbitrary criteria using an LLM judge.

```yaml
tests:
  - vars:
      question: "Explain quantum computing to a 10-year-old"
    assert:
      - type: llm-rubric
        value: >
          The explanation uses simple analogies,
          avoids jargon like 'superposition' or 'entanglement',
          and is no longer than 3 paragraphs
        provider: openai:gpt-4o

  - vars:
      question: "Write a professional email declining a meeting"
    assert:
      - type: llm-rubric
        value: >
          Email is polite but firm, suggests an alternative
          (reschedule or async update), and is under 150 words
```

**When to use:** Subjective quality criteria that cannot be expressed as string matching or regex

---

## llm-rubric With Custom Grading Provider

```yaml
# Use a cheaper model for grading to reduce eval costs
defaultTest:
  options:
    provider: openai:gpt-4o-mini # Default grader for all model-graded assertions

tests:
  - vars:
      question: "Explain recursion"
    assert:
      - type: llm-rubric
        value: "Includes a base case and recursive case in the explanation"
        # Uses defaultTest.options.provider (gpt-4o-mini) for grading

      - type: llm-rubric
        value: "Code example compiles and demonstrates recursion correctly"
        provider: openai:gpt-4o # Override: use stronger model for code evaluation
```

---

## factuality (Ground Truth Accuracy)

Checks whether the output is factually consistent with provided ground truth.

```yaml
tests:
  - vars:
      question: "What is the capital of France?"
    assert:
      - type: factuality
        value: "The capital of France is Paris. Paris has a population of approximately 2.1 million in the city proper."
        provider: openai:gpt-4o

  - vars:
      question: "When was Python created?"
    assert:
      - type: factuality
        value: "Python was created by Guido van Rossum and first released in 1991."
        provider: openai:gpt-4o
```

**When to use:** Validating factual accuracy against known ground truth -- stricter than `llm-rubric`

---

## model-graded-closedqa (Closed-Domain QA)

Uses OpenAI's public evals prompt for closed-domain question answering. Checks if the answer correctly addresses the question given a reference answer.

```yaml
tests:
  - vars:
      question: "What year was the Eiffel Tower completed?"
    assert:
      - type: model-graded-closedqa
        value: "The Eiffel Tower was completed in 1889."
        provider: openai:gpt-4o
```

**When to use:** Question-answer pairs with definitive correct answers -- more specific than `llm-rubric`

---

## similar (Semantic Similarity)

Compares output to a reference using embedding-based cosine similarity. Does not require an LLM call for grading -- uses embeddings.

```yaml
tests:
  - vars:
      input: "Bonjour le monde"
    assert:
      - type: similar
        value: "Hello world"
        threshold: 0.8 # 0.0 to 1.0 -- higher = more similar required

  - vars:
      input: "What is machine learning?"
    assert:
      - type: similar
        value: "Machine learning is a subset of AI that enables systems to learn from data"
        threshold: 0.7
```

**When to use:** Comparing semantic meaning when exact wording varies -- cheaper than `llm-rubric`

---

## RAG Context Evaluation

Evaluate retrieval-augmented generation quality across multiple dimensions.

```yaml
tests:
  - vars:
      question: "What is our refund policy?"
      context: "Refunds are available within 30 days of purchase for unused items with original receipt."
    assert:
      # Is the answer faithful to the retrieved context?
      - type: context-faithfulness
        threshold: 0.9
        provider: openai:gpt-4o

      # Does the context contain the information needed to answer?
      - type: context-recall
        value: "Refunds require original receipt and must be within 30 days"
        threshold: 0.8
        provider: openai:gpt-4o

      # Is the retrieved context relevant to the question?
      - type: context-relevance
        threshold: 0.8
        provider: openai:gpt-4o

      # Is the answer relevant to the question asked?
      - type: answer-relevance
        threshold: 0.8
        provider: openai:gpt-4o
```

**When to use:** Evaluating RAG pipeline quality -- faithfulness prevents hallucination, recall ensures coverage

---

## Custom JavaScript Assertion

For evaluation logic that no built-in assertion handles.

```yaml
tests:
  - vars:
      question: "Generate a JSON user profile"
    assert:
      # Inline JavaScript
      - type: javascript
        value: |
          const parsed = JSON.parse(output);
          const hasRequiredFields = parsed.name && parsed.email && parsed.role;
          const validEmail = parsed.email.includes('@');
          return {
            pass: hasRequiredFields && validEmail,
            score: hasRequiredFields && validEmail ? 1.0 : 0.0,
            reason: hasRequiredFields
              ? (validEmail ? 'Valid profile' : 'Invalid email format')
              : 'Missing required fields (name, email, role)',
          };

      # From file
      - type: javascript
        value: file://assertions/validate-profile.js
```

```javascript
// assertions/validate-profile.js
module.exports = (output, context) => {
  const { vars } = context;
  const parsed = JSON.parse(output);

  const checks = [
    { name: "has name", pass: Boolean(parsed.name) },
    { name: "has email", pass: Boolean(parsed.email) },
    {
      name: "valid role",
      pass: ["admin", "user", "viewer"].includes(parsed.role),
    },
  ];

  const passed = checks.filter((c) => c.pass);
  const failed = checks.filter((c) => !c.pass);

  return {
    pass: failed.length === 0,
    score: passed.length / checks.length,
    reason:
      failed.length > 0
        ? `Failed: ${failed.map((c) => c.name).join(", ")}`
        : "All checks passed",
  };
};
```

---

## Custom Python Assertion

```yaml
assert:
  - type: python
    value: file://assertions/validate.py
```

```python
# assertions/validate.py
import json

def get_assert(output, context):
    try:
        data = json.loads(output)
        has_name = bool(data.get("name"))
        has_email = bool(data.get("email"))
        return {
            "pass": has_name and has_email,
            "score": 1.0 if (has_name and has_email) else 0.0,
            "reason": "Valid" if (has_name and has_email) else "Missing fields",
        }
    except json.JSONDecodeError:
        return {
            "pass": False,
            "score": 0.0,
            "reason": "Output is not valid JSON",
        }
```

---

## Combining Deterministic and Model-Graded

Best practice: use deterministic assertions for structure, model-graded for quality.

```yaml
tests:
  - vars:
      task: "Generate a product description for a laptop"
    assert:
      # Structure checks (fast, free, deterministic)
      - type: is-json
      - type: javascript
        value: |
          const parsed = JSON.parse(output);
          return {
            pass: parsed.title && parsed.description && parsed.price,
            score: 1.0,
            reason: 'Has required fields',
          };

      # Quality checks (LLM-graded, slower, costs money)
      - type: llm-rubric
        value: >
          Description is compelling, highlights key features,
          and is appropriate for an e-commerce listing
        provider: openai:gpt-4o

      # Performance checks
      - type: cost
        threshold: 0.02
      - type: latency
        threshold: 3000
```

---

## Negating Model-Graded Assertions

```yaml
assert:
  # Output must NOT be a refusal
  - type: not-is-refusal

  # Output must NOT be similar to a known bad response
  - type: not-similar
    value: "I cannot help with that request"
    threshold: 0.8
```

---

_For basic config and deterministic assertions, see [core.md](core.md). For API reference, see [reference.md](../reference.md)._
