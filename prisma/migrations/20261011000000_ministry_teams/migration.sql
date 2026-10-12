CREATE TYPE "MinistryTeam" AS ENUM ('SINGERS', 'BAND');

ALTER TABLE "Membership"
ADD COLUMN "ministryTeam" "MinistryTeam" NOT NULL DEFAULT 'SINGERS',
DROP COLUMN "vocalPart";

DROP TYPE "VocalPart";

UPDATE "Choir"
SET "name" = 'Elayone Music Ministry',
    "description" = 'A ministry serving through music.'
WHERE "id" = 'elayone-main-choir';
