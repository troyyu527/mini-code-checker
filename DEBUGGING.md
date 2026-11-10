## 2026-11-10 · 3D view empty, no error
- Symptom: "Model loaded", but the building is pushed to the bottom of the 3D area.
- Where: Elements panel → two <canvas> in the viewport.
- Cause: Viewport cleanup did not call viewer.dispose(); StrictMode mounts twice.
- Fix: dispose() in the cleanup.
- Lesson: no error message → inspect the state (count the canvases).
