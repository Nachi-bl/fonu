# Vercel deployment

Import this repository as **one Vercel project**, using the repository root as Root
Directory. Do not select `apps/web` or `apps/api` as the root.

## Project settings

These settings are also checked in as `vercel.json`:

| Setting          | Value                  |
| ---------------- | ---------------------- |
| Framework Preset | Other                  |
| Root Directory   | Repository root (`.`)  |
| Node.js          | 22.x                   |
| Install Command  | `npm ci`               |
| Build Command    | `npm run vercel:build` |
| Output Directory | `apps/web/dist`        |

The build generates Prisma and compiles NestJS with decorator metadata, then builds React.
`api/index.js` runs the compiled API as a cached Node function without opening a port.
The function bundle includes the compiled server, Prisma engine, and Swagger assets.
Static assets are served by Vercel; `/api/*` goes to NestJS. Frontend routes fall back to
`index.html`, so refreshing `/orders/...` or `/admin/products` works.

## Environment variables

Set these in **Project Settings → Environment Variables**. Local `.env` files are excluded
from Vercel uploads and must not be committed or bundled in the frontend.

| Variable                | Value                                                           |
| ----------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`          | Hosted PostgreSQL pooled connection URL                         |
| `JWT_SECRET`            | Random secret with at least 32 characters                       |
| `CORS_ORIGIN`           | Production frontend origin, e.g. `https://stockroom.example`    |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name                                           |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                                              |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                                           |
| `CLOUDINARY_FOLDER`     | `stockroom/products`                                            |
| `PAYSTACK_SECRET_KEY`   | Paystack test secret for testing, live secret for live payments |

Leave `VITE_API_BASE_URL` unset; its default `/api/v1` uses the same domain. Do not set it
to localhost. `PORT` and seed passwords are not needed on Vercel. Production, branch, and
deployment URLs from Vercel's system environment are accepted automatically. Add custom
domains to `CORS_ORIGIN`, separated by commas if necessary.

Use separate Preview and Production databases and payment credentials. Use a pooled
PostgreSQL URL suitable for serverless connections. You can limit Prisma connections
using the URL's `connection_limit` parameter and choose a Vercel function region near
your database.

## Migrations

Builds do not migrate or seed databases. Before deploying a release, apply its committed
migrations from a trusted local or release environment:

```sh
npm ci
npm run db:generate
npm run db:deploy
```

`db:deploy` reads a root `.env` when present, or the release environment's variables.
Check the target database first. The currently configured database already contains the
application migrations and administrator. Seed only when setting up a fresh demo database,
with the seed variables supplied locally; never automatically seed production builds.

## Image uploads

Vercel has a [4.5 MB function request limit](https://vercel.com/docs/functions/limitations).
The UI requests an admin-only signature from `/api/v1/products/images/signature`, then
sends image bytes directly to Cloudinary. This preserves the seven-image gallery and
10 MB per-image picker limit without routing image bytes through a Vercel function.
The secret remains on the server; see [Cloudinary signed uploads](https://cloudinary.com/documentation/authentication_signatures).

Successful uploads are kept in the form if another file fails, so retries upload only
the remaining files. Closing the editor or removing an image does not delete the cloud
asset; unused-asset cleanup remains a maintenance task. The legacy multipart endpoint
is retained for compatibility and is subject to Vercel's request limit.

## After deployment

1. Open `/`, then refresh `/login` and `/admin/products` directly.
2. Check `/api/v1/products?limit=1` returns JSON and `/api/docs` opens Swagger.
3. Sign in as the administrator and upload an image.
4. Sign in as a customer and complete a Paystack **test** transaction.
5. Confirm the callback marks the order Paid and disables cancellation.

The token stays in memory, so Paystack's full-page return can require signing in again
before verification. Production webhook reconciliation remains a follow-up. Rate limits
are per warm function instance; a shared limiter or Vercel Firewall can enforce global
production limits.

Publishing requires importing this repository into your Vercel account and setting its
environment variables. These local changes do not create a hosted deployment.

References: [Node functions](https://vercel.com/docs/functions/runtimes/node-js),
[configuration](https://vercel.com/docs/project-configuration/vercel-json).
