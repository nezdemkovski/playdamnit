# @playdamnit/web

React SPA for PlayDamnIt: Vite 8, TanStack Router + Query, Tailwind 4, shadcn/ui.

```bash
cp .env.local.example .env.local   # VITE_API_URL
bun run dev                        # http://localhost:3000, expects the API on :3030
bun run build                      # dist/ (served by nginx in the Docker image)
```

- Pages live in `src/routes/` (file-based routing; `src/routeTree.gen.ts` is generated).
- `src/components/ui/` is shadcn/ui exactly as the CLI ships it; add components with
  `bunx shadcn@latest add <name>` and never edit the files. The theme is the set of CSS
  variables in `src/globals.css`.
- API calls go through `@playdamnit/api-client` (generated from `packages/api-client/spec.yaml`);
  see `src/hooks/` for the library and auth wrappers.
