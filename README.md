# TaskFlow (DEORIS Module)

Assignment and coursework management service for the DEORIS ecosystem.

## Architecture

- **Identity**: DEORIS Portal only (`https://deoris.test/module-bridge.js` + SSO session). No local `users` table.
- **Database**: Owned by TaskFlow (`deoris_taskflow`) — assignments, submissions, activity logs, sessions.
- **API**: `/taskflow/api/*` (session-authenticated, CSRF-protected).
- **UI reference**: EntryEase module shell pattern (loader → portal SSO → Laravel session handoff).

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
```

Create MySQL database `deoris_taskflow`, set `APP_URL` and `APP_PORTAL_URL`, then open the module from the portal iframe at `https://taskflow.deoris.test`.

## Spec gap (not yet implemented)

Event hub publishing, Redis queues/broadcasting, `/api/v1` REST surface, advanced SQL (views/procedures), file storage, federated search, and full dashboard set from the product spec are planned follow-ups.
