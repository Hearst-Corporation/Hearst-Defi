import { makePrismaClient } from "./lib/prisma-cli";
const p = makePrismaClient();
async function main(){
  const v = await p.vaultDeployment.findMany({ select: { id: true }, take: 3 });
  console.log("VAULT_IDS=" + v.map(x=>x.id).join(","));
  const d = await p.vaultDraft.findMany({ select: { id: true }, take: 2 }).catch(()=>[] as any[]);
  console.log("DRAFT_IDS=" + d.map((x:any)=>x.id).join(","));
  const dist = await p.distribution.findMany({ select: { id: true }, take: 2 }).catch(()=>[] as any[]);
  console.log("DISTRIBUTION_IDS=" + dist.map((x:any)=>x.id).join(","));
  const rd = await p.reviewDocument.findMany({ select: { id: true }, take: 2 }).catch(()=>[] as any[]);
  console.log("REVIEWDOC_IDS=" + rd.map((x:any)=>x.id).join(","));
  await p.$disconnect();
}
main();
