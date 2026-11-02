DROP INDEX IF EXISTS "User_emailVerificationTokenHash_key";

ALTER TABLE "User"
DROP COLUMN IF EXISTS "emailVerifiedAt",
DROP COLUMN IF EXISTS "emailVerificationTokenHash",
DROP COLUMN IF EXISTS "emailVerificationExpiresAt";