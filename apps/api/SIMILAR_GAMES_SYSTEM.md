# Similar Games System

Similar games are stored in `game_to_similar_game` (bidirectional rows, composite PK).

1. When the librarian writes a game that has `similar_games`, it enqueues
   `process-similar-games` with `{ gameId, similarGameIds, depth }`.
2. The worker links every similar game that already exists in PostgreSQL, in both directions.
3. Missing similar games are fetched with `fetch-by-ids` only while
   `depth + 1 <= SIMILAR_GAMES_MAX_DEPTH` (default `1`: games a user asked for get their
   similar games, and the crawl stops there).
4. A game fetched later runs its own `process-similar-games` job, which links it back.

`GET /api/games/:id` returns `similarGames: [{ id }]`; list endpoints don't include them.
See `ARCHITECTURE.md` for the queue contract.
