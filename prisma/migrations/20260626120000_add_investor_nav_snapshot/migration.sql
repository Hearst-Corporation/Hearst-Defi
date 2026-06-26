-- CreateTable
CREATE TABLE "InvestorNavSnapshot" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "valueUsdc" DECIMAL(65,30) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'computed',

    CONSTRAINT "InvestorNavSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestorNavSnapshot_investorId_takenAt_idx" ON "InvestorNavSnapshot"("investorId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorNavSnapshot_investorId_takenAt_key" ON "InvestorNavSnapshot"("investorId", "takenAt");

-- AddForeignKey
ALTER TABLE "InvestorNavSnapshot" ADD CONSTRAINT "InvestorNavSnapshot_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
