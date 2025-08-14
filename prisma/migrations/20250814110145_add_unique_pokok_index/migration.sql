-- Unique index: 1x saja simpanan POKOK berstatus POSTED per anggota
CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_pokok_posted"
ON "Transaction"("memberId")
WHERE "category" = 'POKOK' AND "status" = 'POSTED';
