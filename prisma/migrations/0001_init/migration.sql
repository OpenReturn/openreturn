CREATE TABLE "ReturnRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "externalOrderId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "labelTrackingNumber" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReturnRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnEventRecord" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actor" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReturnEventRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReturnRecord_customerEmail_idx" ON "ReturnRecord"("customerEmail");
CREATE INDEX "ReturnRecord_status_idx" ON "ReturnRecord"("status");
CREATE INDEX "ReturnRecord_labelTrackingNumber_idx" ON "ReturnRecord"("labelTrackingNumber");
CREATE INDEX "ReturnEventRecord_returnId_idx" ON "ReturnEventRecord"("returnId");
CREATE INDEX "ReturnEventRecord_type_idx" ON "ReturnEventRecord"("type");

ALTER TABLE "ReturnEventRecord"
ADD CONSTRAINT "ReturnEventRecord_returnId_fkey"
FOREIGN KEY ("returnId") REFERENCES "ReturnRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
