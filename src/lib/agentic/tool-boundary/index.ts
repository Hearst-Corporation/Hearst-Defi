// Tool Boundary v1 — barrel export.
//
// A pure, read-only reflection of the real LLM tool registry: tiers, gates,
// risks, runtime status, and static-vs-code consistency. No tool is ever
// executed; no registry/runtime behaviour is changed.

export * from "./types";
export {
  reflectRealToolIds,
  REFLECTED_TOOL_META,
  REAL_READ_TOOL_IDS,
  REAL_WRITE_TOOL_IDS,
  TOOL_REGISTRY_SOURCE,
  TOOL_IDS_SOURCE,
  type ReflectedToolMeta,
  type ReflectedToolId,
} from "./registry-reflection";
export {
  classifyReflectedTool,
  classifyAllTools,
  FORBIDDEN_AUTONOMOUS_ACTIONS,
} from "./classify-tool";
export {
  checkToolBoundaryConsistency,
  type StaticBoundaryView,
} from "./consistency";
export { buildToolBoundaryV1Summary, countByTier } from "./summary";
