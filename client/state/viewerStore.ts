// Viewer state: load status, the model's facts, the selected element, and the function that runs commands.
import { create } from "zustand";
import type { ModelExtract } from "@shared/elementFacts";
import { type ViewerCommand, ViewerCommandSchema } from "@shared/viewerCommand";

export type CommandResult = { ok: true } | { ok: false; error: string };
type Runner = (cmd: ViewerCommand) => CommandResult;

export type LoadStatus = { state: "idle" } | { state: "loading" } | { state: "ready"; ms: number } | { state: "error"; message: string };

interface ViewerState {
  status: LoadStatus;
  model: ModelExtract | null;
  selectedId: string | null;
  runner: Runner | null;
  /** Commands that arrived before the model finished loading. */
  pending: { cmds: ViewerCommand[]; select: string | null };
  setStatus(status: LoadStatus): void;
  setModel(model: ModelExtract | null): void;
  select(globalId: string | null): void;
  setRunner(runner: Runner | null): void;
  /** Validates a command (it may come from an AI answer) and runs it. */
  run(cmd: unknown): CommandResult;
  /** Runs now when the model is ready; otherwise keeps the commands until it is. */
  runWhenReady(cmds: ViewerCommand[], select?: string): void;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  status: { state: "idle" },
  model: null,
  selectedId: null,
  runner: null,
  pending: { cmds: [], select: null },
  setStatus: (status) => set({ status }),
  setModel: (model) => set({ model }),
  select: (selectedId) => set({ selectedId }),
  setRunner: (runner) => {
    set({ runner });
    const { pending } = get();
    if (runner && (pending.cmds.length || pending.select)) {
      for (const c of pending.cmds) runner(c);
      set({ pending: { cmds: [], select: null }, ...(pending.select ? { selectedId: pending.select } : {}) });
    }
  },
  run: (cmd) => {
    const parsed = ViewerCommandSchema.safeParse(cmd);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid command" };
    const runner = get().runner;
    return runner ? runner(parsed.data) : { ok: false, error: "the 3D view is not ready" };
  },
  runWhenReady: (cmds, select) => {
    const { runner, run } = get();
    if (runner) {
      cmds.forEach(run);
      if (select) set({ selectedId: select });
    } else {
      set({ pending: { cmds, select: select ?? null } });
    }
  },
}));
