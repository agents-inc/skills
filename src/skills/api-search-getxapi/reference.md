# GetXAPI Reference

## Authentication

All requests must include the `Authorization` header:

```
Authorization: Bearer $GETXAPI_API_KEY
```

## Endpoint Base

```
https://api.getxapi.com
```

Override with `GETXAPI_BASE_URL` for non-default deployments.

## Endpoints

### `GET /twitter/tweet/advanced_search`

Required query parameters:

- `q`: search query string

Optional query parameters:

- `limit`: maximum result count

### User Lookup

Resolve users and fetch profile metadata through the user endpoints. Validate
the user ID or username first, then use the narrowest endpoint that satisfies
the request.

### Replies

Fetch replies to a given tweet by tweet URL or tweet ID.

## Error Codes

- `400`: invalid parameters
- `401`: missing or invalid `GETXAPI_API_KEY`
- `429`: respect `Retry-After`
- `5xx`: retry read-only requests with exponential backoff up to 3 attempts

## Write Operations

Write operations are gated behind `GETXAPI_ENABLE_ACTIONS=true`. Default
configuration is read-only.
