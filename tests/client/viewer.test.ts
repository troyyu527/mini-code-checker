import { beforeEach, describe, expect, it } from "vitest";
import { ViewerCommandSchema } from "@shared/viewerCommand";
import { useViewerStore } from "../../client/state/viewerStore";

const GID = "3TakfvuqXJzADJAiopzYwD"; // D-104

describe("ViewerCommandSchema", () => {
  it("accepts a highlight of a real GlobalId", () => {
    expect(ViewerCommandSchema.safeParse({ action: "highlight", globalIds: [GID] }).success).toBe(true);
  });
  it.each([
    [{ action: "highlight", globalIds: [] }, "no elements"],
    [{ action: "highlight", globalIds: ["D-104"] }, "a name, not a GlobalId"],
    [{ action: "explode" }, "an unknown action"],
  ])("refuses %j (%s)", (cmd, _why) => {
    expect(ViewerCommandSchema.safeParse(cmd).success).toBe(false);
  });
});

describe("viewerStore", () => {
  beforeEach(() => useViewerStore.setState({ runner: null, pending: { cmds: [], select: null }, selectedId: null }));

  it("keeps commands until the viewer is ready, then runs them", () => {
    const ran: string[] = [];
    useViewerStore.getState().runWhenReady([{ action: "zoom", globalIds: [GID] }], GID);
    expect(ran).toEqual([]);
    useViewerStore.getState().setRunner((c) => (ran.push(c.action), { ok: true }));
    expect(ran).toEqual(["zoom"]);
    expect(useViewerStore.getState().selectedId).toBe(GID);
  });
  it("refuses a command that is not valid (it may come from an LLM)", () => {
    useViewerStore.getState().setRunner(() => ({ ok: true }));
    expect(useViewerStore.getState().run({ action: "highlight", globalIds: ["too-short"] })).toMatchObject({ ok: false });
  });
  it("says so when there is no viewer yet", () => {
    expect(useViewerStore.getState().run({ action: "reset" })).toEqual({ ok: false, error: "the 3D view is not ready" });
  });
});