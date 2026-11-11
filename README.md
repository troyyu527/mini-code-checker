# Mini Code Checker

A small BIM model checker: it reads an IFC model, checks it with deterministic rules
and shows the findings in a 3D viewer. An AI assistant answers questions about the
findings and searches the building code text (RAG).

## Run it locally

Needs Node.js 24 or newer and [Ollama](https://ollama.com) with the two models named in `.env.example`.

```powershell
npm install
Copy-Item .env.example .env   # then set CLAUSES_PATH to your clause file
npm run seed                  # sample model facts and report -> local D1
npm run ingest                # clause text -> local D1 and vectors
npm run dev:server            # terminal 1: the Worker API
npm run dev                   # terminal 2: the website
```

## Check it

```powershell
npm test         # unit tests
npm run build    # type check + production build
```

## More

- `SECURITY.md`: the checklist to run before every deploy
- `DEBUGGING.md`: problems we hit and how we found them
