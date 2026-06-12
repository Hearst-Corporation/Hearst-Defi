import { PtaiSchema, type Ptai as PtaiPayload } from "@/lib/agents/schemas";

export function extractPtaiFromCalldata(calldata: string | null): PtaiPayload | null {
  if (calldata === null || calldata.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(calldata);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const candidate = (parsed as { ptai?: unknown }).ptai ?? parsed;
  const result = PtaiSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

export function formatProposalCalldata(calldata: string): string {
  try {
    return JSON.stringify(JSON.parse(calldata), null, 2);
  } catch {
    return calldata;
  }
}
