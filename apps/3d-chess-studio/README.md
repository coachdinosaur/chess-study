# CD Digital 3D Chess Position Studio

A completely client-side 3D chess position editor. It runs as static HTML,
CSS, JavaScript, and a local GLB chess model—no application server, database,
worker, sign-in, or runtime API is required.

## Prerequisites

- Node.js `>=22.13.0`

## Local development

```bash
npm install
npm run dev
```

Create and preview the exact production files:

```bash
npm run build
npm run preview
```

The static site is written to `dist/`.

## Deploying below a URL path

Set `VITE_BASE_PATH` while building. CD Digital publishes this app at `/3d/`:

```bash
VITE_BASE_PATH=/3d/ npm run build
```

Every generated asset URL, including the Staunton GLB model, uses that base
path. The `coachdinosaur/chess-study` Pages workflow builds this project and
publishes `dist/` as `https://cddigital.top/3d/`.
