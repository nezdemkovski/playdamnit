-- Email confirmation goes on with this release. Accounts made before it never had a way to
-- confirm their address, so they count as confirmed instead of being stopped at sign-in.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
