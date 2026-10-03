# Design

## Context

See proposal.md. Today `create_app()` registers a catch-all `/api/{path:path}` for all methods that always raises
404; it must stay last so it never shadows real routes, and it exists because `app.frontend()` would otherwise
answer a browser's `GET /api/<unknown>` with `index.html` (see the archived `add-project-skeleton` design).

A probe against FastAPI 0.142.2 (TestClient, same router layout) showed:

| catch-all methods | `POST /api/health` | `POST /api/nope` | `GET /api/nope` (html) |
|---|---|---|---|
| all (today) | 404 | 404 | 404 JSON |
| `GET` only | 405 `Allow: GET` | **405** ✗ | 404 JSON |
| `GET`+`HEAD` | 405 `Allow: GET` | **405** ✗ | 404 JSON |

So narrowing the catch-all's methods breaks "Unknown API paths return 404".

## Goals / Non-Goals

**Goals:** 405 + `Allow` for a known path with a wrong method; 404 for unknown paths with any method.

**Non-Goals:**
- Answering `HEAD` like `GET` (200 without body). Under this change `HEAD /api/health` gets `405 Allow: GET`,
  consistent with the rule; automatic `HEAD` support can be its own change if a client needs it.
- `OPTIONS`/CORS handling — same origin, nothing to negotiate.

## Decisions

- **Keep one catch-all for all methods; decide 404 vs 405 inside it.** The handler receives the `Request`, walks
  the app's routes and asks each `APIRoute` (other than itself) whether it matches the request scope. A partial match
  (path matches, method does not) means the path exists: collect that route's methods and raise 405 with
  `Allow: <sorted, comma-separated methods>`. No partial match → 404. This uses Starlette's own matcher, so path
  parameters in future routes are handled the same way the router handles them.
- **Alternative rejected — catch-all for `GET`/`HEAD` only:** breaks unknown-path 404 for other methods (probe above).
- **Alternative rejected — a 405-to-404 exception handler:** would need to re-derive the same "does the path exist"
  question from the outside and couples behaviour to Starlette's exception internals.
- The catch-all stays the last `/api` route; a code comment already says so.

## Risks / Trade-offs

- [Walking routes on every unknown `/api` request] → only on the error path, a handful of routes; negligible.
- [Future routers mounted outside the `/api` router] → the walk covers all app routes, not only the `/api` router.
