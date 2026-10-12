-- Steam syncs used to bump updated_at on every entry they touched, which the activity map
-- reads as the user's own edits. Rows written by the last sync go back to their add date.
UPDATE "user_games" AS "ug"
SET "updated_at" = "ug"."added_at"
FROM "user" AS "u"
WHERE "u"."id" = "ug"."user_id"
  AND "u"."steam_synced_at" IS NOT NULL
  AND "ug"."steam_minutes" IS NOT NULL
  AND "ug"."updated_at" BETWEEN "u"."steam_synced_at" - interval '2 minutes' AND "u"."steam_synced_at";
