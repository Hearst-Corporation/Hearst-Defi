/**
 * Portfolio chart geometry — barrel export.
 *
 * Shared pure SVG math used by value-chart (line/area) and distrib-calendar
 * (bars). viewBox dimensions are injected per call site, so no chart hardcodes
 * another's coordinate system.
 */
export type { Pt, ViewBox } from "./types";
export { project, baseline } from "./project";
export { smoothPath, areaFromLine } from "./smooth-path";
export { barX, barHeight } from "./bars";
