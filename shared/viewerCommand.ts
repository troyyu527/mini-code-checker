// ViewerCommand: what the UI or the AI assistant may ask the 3D viewer to do. Checked with zod before it runs,
// because a command can come from an LLM answer.
import { z } from "zod";

const GlobalId = z.string().regex(/^[0-9A-Za-z_$]{22}$/, "IFC GlobalId (22 characters)");
const GlobalIds = z.array(GlobalId).min(1).max(200);

export const ViewerCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("highlight"), globalIds: GlobalIds }),
  z.object({ action: z.literal("zoom"), globalIds: GlobalIds }),
  z.object({ action: z.literal("show_issues"), issues: z.array(z.object({ globalId: GlobalId, severity: z.enum(["major", "minor"]) })).max(200) }),
  z.object({ action: z.literal("reset") }),
]);
export type ViewerCommand = z.infer<typeof ViewerCommandSchema>;
