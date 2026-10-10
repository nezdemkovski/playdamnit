// Bun auto-loads .env, which points at a real database. Tests must never use it:
// integration tests get TEST_POSTGRES_URL, unit tests an address nothing listens on.
process.env.POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ?? "postgres://test:test@127.0.0.1:1/unit_tests_have_no_db";
process.env.NODE_ENV = "test";
