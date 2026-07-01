/**
 * Product strategies — public barrel. Import from here.
 */
export * from "./types";
export { PRODUCT_STRATEGIES, getFallbackStrategy } from "./strategies.config";
export { validateStrategy, validateStrategySet, type StrategyViolation } from "./validate";
export { selectProductStrategy } from "./select";
export { objectiveProfileToSelectionRequest } from "./from-objective";
