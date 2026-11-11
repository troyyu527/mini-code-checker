## 2026-11-10 · 3D view empty, no error
- Symptom: "Model loaded", but the building is pushed to the bottom of the 3D area.
- Where: Elements panel → two <canvas> in the viewport.
- Cause: Viewport cleanup did not call viewer.dispose(); StrictMode mounts twice.
- Fix: dispose() in the cleanup.
- Lesson: no error message → inspect the state (count the canvases).

## 2026-11-11 · Questions about the findings get a question back (live)
- Symptom: "Which findings are errors?" → "What specific findings are you referring to?" (route ask_user).
- Where: npm run eval:routing (tests/golden/routing.json): 10/14 with gemma4 locally AND with qwen3 deployed.
- Cause: only code could choose the finding route (names, F-ids, "all … findings"); the LLM could only pick
  question or ask_user. Not the model: both models failed the same 4.
- Fix: PR #13 and #15 (report words, the model's doors and rooms, unique room names unless the message is about the
  code). 18/18 on both models; released with npm run deploy:server, checked on the live URL.
- Lesson: reproduce locally and test the first guess ("the model changed") before fixing.

## Open
- "Which findings are errors?": the writer calls all four findings "errors"; the report has minor and major only.
- "Does the corridor in the model meet the minimum width?" → "meets … as there are no findings". There is no corridor
  width rule, so no finding does not mean it passes. The writer must say which rules were checked.
