-- One-time passwords for new accounts and resets expire (see features/auth/one-time-password.ts).
ALTER TABLE "users" ADD COLUMN "temporaryPasswordExpiresAt" TIMESTAMP(3);
