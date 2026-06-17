import { Badge } from "@/components/ui/badge";

interface ChainStatusBadgeProps {
  configured: boolean;
  eventCount: number;
  attestationCount: number;
}

export function ChainStatusBadge({
  configured,
  eventCount,
  attestationCount,
}: ChainStatusBadgeProps) {
  if (!configured) {
    return (
      <Badge
        variant="warning"
        title="No on-chain contracts configured yet. Showing paper attestations only."
      >
        Off-chain · paper attestations only
      </Badge>
    );
  }

  const total = eventCount + attestationCount;
  if (total === 0) {
    return (
      <Badge
        variant="default"
        title="Contracts are configured on a test network but no events have been published yet."
      >
        Connected · test network · no on-chain events yet
      </Badge>
    );
  }

  const parts: string[] = [];
  if (eventCount > 0) {
    parts.push(`${eventCount} event${eventCount === 1 ? "" : "s"}`);
  }
  if (attestationCount > 0) {
    parts.push(
      `${attestationCount} attestation${attestationCount === 1 ? "" : "s"}`,
    );
  }

  return (
    <Badge
      variant="success"
      title="Reading on-chain events directly from a test network."
    >
      Connected · test network · {parts.join(" + ")}
    </Badge>
  );
}
