# Security checklist

Run it before every deploy. "How to check" is a command or a place to look; write the date when it passed.

| # | Check | How to check | Passed |
|---|-------|--------------|--------|
| 1 | `.env` is ignored and was never committed | `git check-ignore -v .env` prints a rule; `git log --all --oneline -- .env` prints nothing | |
| 2 | No secret in the frontend: the only `VITE_` variable is `VITE_API_URL` | `npm run build`, then search `dist/assets/*.js` for every name in `.env` | |
| 3 | CORS lists only our own sites, never `*` | `ALLOWED_ORIGINS` in `wrangler.jsonc`; `curl.exe -i -H "Origin: https://evil.example" <api>/api/health` → 403 | |
| 4 | Every route checks its input with zod | too long, wrong type, not JSON → 400 | |
| 5 | Errors tell the visitor nothing about the inside | a failing route answers `{"error":"internal error"}`; the details are only in the log | |
| 6 | AI output is shown as text | no `dangerouslySetInnerHTML` in `client/`; links and e-mail addresses removed (`removeLinks`); cites filtered to real evidence ids; viewer commands made by code, not by the LLM | |
| 7 | The prompt marks the visitor's message as data | `<message>` in the writer prompt; the injection messages of lesson 37 | |
| 8 | Usage is limited | per session, per visitor (hashed IP), tokens per day (`readLimits`) | |
| 9 | Dependencies have no known vulnerabilities | `npm audit` → 0 | |
| 10 | Deployed (lesson 39): secrets are Worker secrets; CORS and limits work on the real URL; a forged `CF-Connecting-IP` header does not change the visitor | `wrangler secret list --env production` (`[]`: AI, D1 and Vectorize are bindings, no keys); the curl tests of lesson 37 against the deployed URL. A client-sent `CF-Connecting-IP` is refused by Cloudflare (`403 error code: 1000`) before the Worker runs | 2026-11-11 |
