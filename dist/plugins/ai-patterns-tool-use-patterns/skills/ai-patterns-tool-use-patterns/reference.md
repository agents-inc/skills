# Tool Use Patterns -- Quick Reference

> Decision frameworks, provider comparison, and anti-pattern checklist. See [examples/core.md](examples/core.md) for full implementations.

---

## Provider Tool Format Comparison

All providers use JSON Schema for parameters. The wrapping structure differs:

| Provider  | Tool Wrapper                                                        | Parameter Key  | Tool Call Response                                                    | Result Message                                                |
| --------- | ------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| OpenAI    | `{ type: "function", function: { name, description, parameters } }` | `parameters`   | `message.tool_calls[]` with `function.arguments` (JSON string)        | `{ role: "tool", tool_call_id, content }`                     |
| Anthropic | `{ name, description, input_schema }`                               | `input_schema` | Content block `{ type: "tool_use", id, name, input }` (parsed object) | Content block `{ type: "tool_result", tool_use_id, content }` |
| Google    | `FunctionDeclaration { name, description, parameters }`             | `parameters`   | `function_call { name, id, args }` (parsed object)                    | `function_response { name, id, response }`                    |

**Key differences:**

- OpenAI returns arguments as a **JSON string** -- you must `JSON.parse()`
- Anthropic returns arguments as a **parsed object** -- no parsing needed
- OpenAI uses `role: "tool"` messages; Anthropic uses `tool_result` content blocks
- Tool choice syntax differs: OpenAI `"required"` vs Anthropic `{ type: "any" }`
- Google Gemini 3+ models generate a unique `id` for each function call -- include the matching `id` in your `functionResponse`

**Recommendation:** Abstract the provider format in a `callLLM()` wrapper that normalizes tool calls into a common shape. All examples in this skill use this normalized format.

---

## Tool Choice Quick Reference

| Mode                    | OpenAI                                     | Anthropic                       | Google                           | Effect                                          |
| ----------------------- | ------------------------------------------ | ------------------------------- | -------------------------------- | ----------------------------------------------- |
| Auto (default)          | `"auto"`                                   | `{ type: "auto" }`              | `AUTO`                           | Model decides                                   |
| Must call a tool        | `"required"`                               | `{ type: "any" }`               | `ANY`                            | Forces at least one tool call                   |
| No tools                | `"none"`                                   | `{ type: "auto" }` + omit tools | `NONE`                           | Text-only response                              |
| Specific tool           | `{ type: "function", function: { name } }` | `{ type: "tool", name }`        | `ANY` + `allowed_function_names` | Forces specific tool                            |
| Validated (Google only) | N/A                                        | N/A                             | `VALIDATED` (preview)            | Schema-validated, allows text or function calls |

---

## Tool Definition Checklist

For each tool definition, verify:

- [ ] **Name** is descriptive and unique (`search_documentation`, not `search`)
- [ ] **Description** explains what the tool returns, when to use it, and when NOT to use it
- [ ] **Parameters** each have a `description` field
- [ ] **Required fields** are listed in `required` array
- [ ] **Enums** constrain string parameters to valid values
- [ ] **Numeric constraints** use `minimum`, `maximum`, `minLength`, `maxLength`
- [ ] **`additionalProperties: false`** prevents hallucinated extra fields
- [ ] **Token cost** is reasonable (description is concise but precise)

---

## Common Anti-Patterns

| Anti-Pattern                                   | Problem                                    | Fix                                                         |
| ---------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `while (true)` loop                            | Infinite API calls, runaway costs          | Use `for` loop with `MAX_STEPS` constant                    |
| No argument validation                         | Malformed input reaches execution          | Validate with Zod before executing                          |
| Silent error swallowing                        | Model cannot recover from unknown failures | Return structured error with message                        |
| `SELECT *` in tool results                     | Context overflow with irrelevant data      | Select specific fields, truncate large results              |
| All tools on every call                        | Token waste, model confusion               | Filter tools per step based on context                      |
| No assistant message before tool results       | Provider rejects message sequence          | Always append assistant message with tool calls first       |
| Parsing streaming argument chunks individually | JSON.parse fails on partial JSON           | Accumulate all chunks, parse once after stream ends         |
| Direct code execution from arguments           | Prompt injection becomes code execution    | Sandbox execution, validate arguments, allowlist operations |
| Caching write-operation results                | Stale data, missed side effects            | Only cache idempotent (read-only) tool results              |
| Generic tool descriptions                      | Wrong tool selection, malformed arguments  | Include what it returns, when to use, when NOT to use       |

---

## Token Cost Estimation

Tool definitions are sent on **every** API call. Estimate token impact:

| Component                              | Approximate Tokens         |
| -------------------------------------- | -------------------------- |
| Tool name + description (50 words)     | ~75 tokens                 |
| Parameter with description (per param) | ~30 tokens                 |
| JSON Schema overhead                   | ~20 tokens                 |
| **Typical tool (3 params)**            | **~185 tokens**            |
| **10 tools**                           | **~1,850 tokens per call** |

**Optimization strategies:**

- Filter tools per step (only send relevant tools)
- Keep descriptions concise but precise
- Use enums instead of verbose description constraints
- Consider combining related tools into one with a `mode` parameter

---

## Message Sequence Diagram

The correct message sequence for a tool call round-trip:

```
1. User message
   { role: "user", content: "What's the weather?" }

2. Assistant response WITH tool calls
   { role: "assistant", toolCalls: [{ id: "tc_1", name: "get_weather", arguments: '{"location":"London"}' }] }

3. Tool result(s) -- one per tool call
   { role: "tool", toolCallId: "tc_1", content: '{"temp": 18, "conditions": "cloudy"}' }

4. Assistant final response (or more tool calls -- loop continues)
   { role: "assistant", content: "The weather in London is 18C and cloudy." }
```

**Critical:** Step 2 (assistant with tool calls) MUST be in the message history before step 3 (tool results). Omitting it breaks the message sequence for most providers.

---

## Step Limit Guidelines

| Agent Complexity                   | Suggested MAX_STEPS | Rationale                              |
| ---------------------------------- | ------------------- | -------------------------------------- |
| Simple lookup (1-2 tools)          | 3-5                 | Quick data fetch, minimal iteration    |
| Research agent (search + analyze)  | 10-15               | Multiple search rounds, analysis       |
| Complex workflow (multi-tool)      | 15-25               | Multiple phases: research, act, verify |
| Code assistant (edit + test + fix) | 20-30               | Edit-test-fix cycles can be lengthy    |

Always include graceful termination: when the step limit is reached, ask the model to provide its best answer with `toolChoice: "none"`.
