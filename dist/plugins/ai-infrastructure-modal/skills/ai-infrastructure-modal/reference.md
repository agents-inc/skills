# Modal Quick Reference

> CLI commands, decorator parameters, URL patterns, GPU types, and SDK API. See [SKILL.md](SKILL.md) for core concepts and [examples/core.md](examples/core.md) for full code examples.

---

## CLI Commands

| Command                            | Purpose                                 |
| ---------------------------------- | --------------------------------------- |
| `modal deploy app.py`              | Deploy persistent production app        |
| `modal serve app.py`               | Start ephemeral dev app with hot-reload |
| `modal run app.py`                 | Run a function once (not deployed)      |
| `modal secret create NAME KEY=VAL` | Create a secret                         |
| `modal secret list`                | List all secrets                        |
| `modal volume create NAME`         | Create a persistent volume              |
| `modal volume ls NAME`             | List volume contents                    |
| `modal token new`                  | Create authentication token             |
| `modal app list`                   | List deployed apps                      |
| `modal app stop APP_NAME`          | Stop a deployed app                     |

---

## Endpoint Decorators

| Decorator                   | Use Case                       | Key Parameters                           |
| --------------------------- | ------------------------------ | ---------------------------------------- |
| `@modal.fastapi_endpoint()` | Simple function endpoints      | `method`, `requires_proxy_auth`, `label` |
| `@modal.asgi_app()`         | Async web frameworks (FastAPI) | `label`                                  |
| `@modal.wsgi_app()`         | Sync web frameworks (Flask)    | `label`                                  |
| `@modal.web_server(port=N)` | Custom servers (vLLM, TGI)     | `port`, `label`                          |

---

## @app.function() Parameters

| Parameter          | Type                         | Purpose                                        |
| ------------------ | ---------------------------- | ---------------------------------------------- |
| `image`            | `modal.Image`                | Container image definition                     |
| `gpu`              | `str`                        | GPU type: `"T4"`, `"A10G"`, `"A100"`, `"H100"` |
| `secrets`          | `list[modal.Secret]`         | Secrets to inject as env vars                  |
| `volumes`          | `dict[str, modal.Volume]`    | Mount paths to volumes                         |
| `schedule`         | `modal.Cron \| modal.Period` | Cron or interval schedule                      |
| `min_containers`   | `int`                        | Minimum warm containers (avoid cold starts)    |
| `max_containers`   | `int`                        | Maximum concurrent containers                  |
| `scaledown_window` | `int`                        | Seconds before scaling to zero (default: 60)   |
| `timeout`          | `int`                        | Max function execution time in seconds         |

---

## GPU Types

| GPU      | VRAM     | Use Case                               |
| -------- | -------- | -------------------------------------- |
| `"T4"`   | 16 GB    | Small models, fine-tuning, embeddings  |
| `"L4"`   | 24 GB    | Medium models, inference               |
| `"A10G"` | 24 GB    | General inference, medium models       |
| `"A100"` | 40/80 GB | Large models (7B-13B params)           |
| `"H100"` | 80 GB    | Largest models (70B+ params), training |

Request multiple GPUs with `"A100:2"` syntax.

---

## URL Patterns

| Type         | Pattern                                               |
| ------------ | ----------------------------------------------------- |
| Deployed     | `https://<workspace>--<app>-<function>.modal.run`     |
| Dev (serve)  | `https://<workspace>--<app>-<function>-dev.modal.run` |
| Custom label | `https://<workspace>--<label>.modal.run`              |

---

## Image Building Methods

```python
modal.Image.debian_slim(python_version="3.11")
    .uv_pip_install(["torch==2.5.0", "transformers"])   # Fast pip (recommended)
    .pip_install(["package"])                             # Standard pip (fallback)
    .apt_install(["ffmpeg", "libgl1"])                   # System packages
    .run_commands("curl https://example.com | bash")     # Shell commands
    .add_local_file("./config.json", "/app/config.json") # Local files
    .add_local_python_source("my_module")                # Local Python modules
```

---

## TypeScript SDK (npm `modal`)

```typescript
import { ModalClient } from "modal";

const modal = new ModalClient();

// Synchronous call
const fn = await modal.functions.fromName("app-name", "function-name");
const result = await fn.remote([arg1, arg2]); // positional args
const result2 = await fn.remote([], { key: "value" }); // keyword args

// Async spawn
const call = await fn.spawn([arg1]);
const result3 = await call.get(); // retrieve later
```

**Requirements:** Node 22+, `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` env vars.

---

## Authentication Headers (Proxy Auth)

```typescript
headers: {
  "Content-Type": "application/json",
  "Modal-Key": process.env.MODAL_PROXY_KEY,     // Token ID
  "Modal-Secret": process.env.MODAL_PROXY_SECRET // Token Secret
}
```

Create tokens at Modal dashboard > Settings > Proxy Auth Tokens.

---

## Limits & Constraints

| Resource                     | Limit                              |
| ---------------------------- | ---------------------------------- |
| Web endpoint request timeout | 150 seconds                        |
| Request rate limit           | 200 req/s (5s burst multiplier)    |
| Request body size            | 4 GiB                              |
| Response body size           | Unlimited                          |
| WebSocket message size       | 2 MiB                              |
| Volume files (v1)            | 500,000                            |
| Volume files (v2)            | Unlimited                          |
| Volume bandwidth             | Up to 2.5 GB/s                     |
| Scheduled function arguments | None (use volumes/secrets/globals) |
| Class parameter types        | `str`, `int`, `bool`, `bytes` only |
