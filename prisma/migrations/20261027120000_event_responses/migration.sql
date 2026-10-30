-- Store event availability separately from actual attendance records.
CREATE TABLE "EventResponse" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventResponse_rehearsalId_userId_key"
    ON "EventResponse"("rehearsalId", "userId");

ALTER TABLE "EventResponse"
    ADD CONSTRAINT "EventResponse_rehearsalId_fkey"
    FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventResponse"
    ADD CONSTRAINT "EventResponse_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing YES/MAYBE/NO replies. PENDING means no saved reply.
INSERT INTO "EventResponse" ("id", "rehearsalId", "userId", "status", "createdAt", "updatedAt")
SELECT "id", "rehearsalId", "userId", "status", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Attendance"
WHERE "status" <> 'PENDING';

ALTER TABLE "Attendance" DROP COLUMN "status";
