# Hat Yai Flood Warning Frontend

Mobile-first public flood monitoring interface for the U-Tapao canal and
Songkhla Lake basin. Built with React 19 + TypeScript and bundled with
[Bun](https://bun.sh) (no Vite runtime, but the public env-var prefix
`VITE_*` is retained for compatibility with existing config).

## Local Development

Install dependencies and start the hot-reloading dev server:

```bash
bun install && bun run dev
```

The dev server runs `bun --hot src/index.tsx` and serves the app on the
port Bun selects (typically `http://localhost:3000`).

Production build:

```bash
bun run build
```

The build script (`build.ts`) emits a static bundle to `dist/`, which is
also what Vercel deploys.

## Environment Variables

All variables that must be exposed to the browser bundle are prefixed
with `VITE_` (the prefix is preserved for historical reasons and is
inlined at build time by `build.ts`).

| Variable            | Required | Description                                                                                 |
| ------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `VITE_API_URL`      | Yes      | Base URL of the FastAPI backend (e.g. `https://hatyai-flood-tracker.up.railway.app`).       |
| `VITE_MAPTILER_KEY` | No       | MapTiler API key for the basemap tiles. Falls back to an open style if unset.               |

Set these in a local `.env` file for development:

```bash
VITE_API_URL=http://localhost:8000
VITE_MAPTILER_KEY=your-maptiler-key
```

For Vercel deployments, configure the same variables in the Vercel
project settings (Production / Preview / Development scopes as needed).

## Deployment

Frontend is deployed to Vercel. Configuration lives in `vercel.json`:

- `installCommand`: `bun install`
- `buildCommand`: `bun run build`
- `outputDirectory`: `dist`
- `cleanUrls`: `true`

After connecting the Vercel project to this GitHub repository, set
`VITE_API_URL` (and optionally `VITE_MAPTILER_KEY`) in the Vercel
project's environment variables, then trigger a deploy. The backend's
CORS allow-list already permits Vercel preview URLs.
