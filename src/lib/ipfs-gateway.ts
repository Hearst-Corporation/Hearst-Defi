/** Resolve IPFS CIDs and URIs to an HTTPS gateway URL. */
export function ipfsGatewayUrl(cid: string): string {
  if (cid.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${cid.slice(7)}`;
  if (cid.startsWith("https://") || cid.startsWith("http://")) return cid;
  return `https://ipfs.io/ipfs/${cid}`;
}
