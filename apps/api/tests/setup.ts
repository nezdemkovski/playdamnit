// Bun auto-loads .env, which points at a real database. Tests must never use it:
// integration tests get TEST_POSTGRES_URL, unit tests an address nothing listens on.
process.env.POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ?? "postgres://test:test@127.0.0.1:1/unit_tests_have_no_db";
process.env.NODE_ENV = "test";
// The webhook receiver reads its secret at import time; the webhook test uses this value
process.env.IGDB_WEBHOOK_SECRET = "test-webhook-secret";
// Never the real Steam key from .env: tests stub fetch, and CI has no key at all
process.env.STEAM_API_KEY = "test-steam-key";
// The demo account the demo test makes, and the origin Better Auth trusts for its requests
process.env.DEMO_USERNAME = "demo";
process.env.DEMO_PASSWORD = "demo-password-for-tests";
process.env.BETTER_AUTH_URL = "http://localhost:3030";
