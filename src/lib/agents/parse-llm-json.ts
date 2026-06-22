/**
 * Defensive JSON extraction from LLM text responses.
 *
 * Models are instructed to return pure JSON, but we strip accidental markdown
 * fences and surrounding prose before `JSON.parse`. Shared by every structured
 * batch/platform agent so fence-stripping logic cannot drift.
 */

/** Strips ```json fences and, when needed, slices to the outermost `{…}` object. */
export function extractLlmJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  let candidate =
    fenced && fenced[1] !== undefined ? fenced[1].trim() : trimmed;
  if (!candidate.startsWith("{")) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      candidate = candidate.slice(start, end + 1);
    }
  }
  return candidate;
}

/**
 * Parses a JSON object from a model response. Throws when the payload is not
 * valid JSON — `context` is included in the error message for log clarity.
 */
export function parseLlmJsonObject(raw: string, context = "Agent"): unknown {
  const candidate = extractLlmJsonCandidate(raw);
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error(
      `${context} returned invalid JSON: ${candidate.slice(0, 200)}`,
    );
  }
}

/** Like {@link parseLlmJsonObject} but returns `null` instead of throwing. */
export function tryParseLlmJsonObject(raw: string): unknown | null {
  const candidate = extractLlmJsonCandidate(raw);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}
