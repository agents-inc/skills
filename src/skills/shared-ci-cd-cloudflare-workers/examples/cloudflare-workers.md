# Cloudflare Workers Examples — Index

> This file has been split into atomic concept files for progressive disclosure. See the individual files below.

- [Setup & Configuration](setup.md) — wrangler.jsonc, project init, basic fetch handler, secrets, multi-env config, CI/CD, testing
- [KV Storage](kv.md) — KV binding, get/put/delete, typed responses, TTL, stale-while-revalidate caching
- [D1 Database](d1.md) — D1 binding, parameterized queries, batch operations, migrations, Hono CRUD API
- [R2 Object Storage](r2.md) — R2 binding, file upload/download/delete with streaming, content-type validation
- [Durable Objects](durable-objects.md) — DO classes, SQLite storage, RPC methods, rate limiter, WebSocket chat with hibernation
- [Routing & Hono](routing.md) — Hono framework, middleware, multi-handler workers, queues, cron, service bindings, Workers AI, streaming
