# Elayone Choir API

## Database setup

The Express API connects to PostgreSQL; never connect the browser directly to the database or put database credentials in frontend environment variables. The Prisma schema and migrations are maintained in this server repository under `prisma/`.

### Local development

Install PostgreSQL 16 (`brew install postgresql@16` on macOS), then copy `.env.example` to `.env`. Replace `YOUR_POSTGRES_USER` in `DATABASE_URL` with your local PostgreSQL role (on a default Homebrew setup, this is usually your macOS username), and set `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Use a unique admin password with at least 12 characters. The database uses port `5433`, matching `db:start`.

```bash
cp server/.env.example server/.env
npm run backend:setup
npm run server:dev
```

Edit `server/.env` first: replace `YOUR_POSTGRES_USER` and change the example JWT and administrator password. Set `DIRECT_URL` to the same local connection as `DATABASE_URL`. `backend:setup` initializes/starts PostgreSQL, creates the named database, applies migrations, and seeds the configured administrator plus sample ministry content (but no songs). It is safe to rerun locally. The API runs on `http://localhost:4000`; the Vite app uses `VITE_API_URL` in `frontend/.env` when the API is elsewhere.

### Supabase production database

Create a Supabase project in the Supabase dashboard and keep its database password private. In **Project Settings → Database → Connection string**, configure the API with:

- `DATABASE_URL`: the **Session pooler** connection string (port `5432`) for the long-running Express API. Add `?sslmode=require` if the copied URI does not already require TLS.
- `DIRECT_URL`: the **Direct connection** string for Prisma migrations. Add `?sslmode=require` if needed. If your deployment environment cannot route to Supabase's direct IPv6 endpoint, run migrations from a network that can, or use the Supabase session-pooler URI for this value.
- `JWT_SECRET`: a new, unique, randomly generated production signing secret.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: the initial administrator credentials; use a unique password of at least 12 characters.
- `CORS_ORIGINS`: the exact HTTPS origin(s) serving the frontend, comma-separated, with no trailing slash.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`), and `SUPABASE_SONGS_BUCKET`: the Supabase project URL, server-only key, and public Storage bucket used for uploaded song media. The bucket defaults to `song-media`.

Set these as **backend deployment secrets/environment variables**, not in frontend build settings or committed files. Keep the pooled and direct database URLs private, and never expose the service-role key to the frontend. Create the configured Storage bucket (`song-media` by default) in Supabase and make it public so song previews can be played by choir members. The app already uses Prisma's pooled URL for normal queries and the direct URL for schema changes.

Deploy the API on a Node.js host. From the repository root, install and build it with `npm ci --prefix server` and `npm run server:build`. Set its start command to `npm run server:start` and configure the backend environment variables listed above in the host dashboard. The host must provide a public HTTPS API URL. Set `VITE_API_URL` to that API URL in the frontend hosting provider, then rebuild and deploy the frontend. The browser talks to the API, and only the API talks to Supabase.

Apply the checked-in migrations to the hosted database with `npm run backend:deploy` after `DATABASE_URL` and `DIRECT_URL` point at the Supabase project. Run this once for a new project, then deploy the API and frontend. The seed command creates or updates the configured admin and adds sample choir content; review `server/src/seed.ts` before using it if you do not want sample content.

For production song records, set `DATABASE_URL` and `DIRECT_URL` to the hosted Supabase PostgreSQL connection strings on the API host. The frontend must point `VITE_API_URL` to that deployed API; it must not connect directly to PostgreSQL. If either the API's database URL or the frontend's API URL still points at localhost, those local requests will continue to use local development services.

Uploaded MP3/MP4 files are sent from the API to the configured Supabase Storage bucket, not stored in the source repository or Render's ephemeral filesystem. The database stores the resulting hosted public URL. Make the bucket public so browser audio playback can read that URL. If the Render service already has `SUPABASE_SECRET_KEY`, the API can use it as the server-side storage key; alternatively name the variable `SUPABASE_SERVICE_ROLE_KEY`. Never put either key in the frontend.

Admins may also create a song with only its title, key, status, and notes. Its audio preview is optional and can be added by uploading audio or supplying a stable external preview URL later. Existing local `/uploads/` files are not migrated automatically; if their source files have been lost and the old Render instance did not have a persistent disk, their audio cannot be recovered from the database because the database only contains the URL and song metadata. Re-upload the original audio when available. If the database write fails after a successful Supabase upload, the API attempts to remove the unreferenced Storage object. Database seed scripts do not add sample songs; songs are created through the administrator screen and API.

The API requires a reachable PostgreSQL database and `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET`. `/health` checks database connectivity and returns HTTP 503 when PostgreSQL is unavailable. Check `npm run db:status` for the local database; request failures are logged by the API and returned to the frontend as JSON. Configure `CORS_ORIGINS` to allow only the deployed frontend origin(s).

## Song storage

Songs created by an administrator are inserted into PostgreSQL's `Song` table.
The song library reads that table from the API, so song details remain available
after reloads and API restarts. Titles, keys, status, notes, and preview URLs
are database fields. Attached MP3/MP4 files live in the configured Supabase
Storage bucket; their hosted public URLs are saved on the song record. The
Supabase project URL, service-role key, and bucket name must be configured on
the API server before admins can upload files. External preview URLs do not
require Storage credentials.

## Access control

- **Administrator:** creates member accounts, manages roles and passwords, and manages ministry content.
- **Leader:** manages events, attendance, announcements, and songs for choirs they belong to; cannot manage user accounts.
- **Member:** views choir content and responds to invitations and attendance.

Protected choir routes require a bearer token from `/api/auth/login`. Choir leaders must be members of the choir they manage; administrators can manage all choirs.

## Service assignment workflow

The platform supports planning schedules from weekly services through special events, worship nights, rehearsals, and broader ministry activity.

- Weekly services
- Multiple services
- Special events
- Worship nights
- Rehearsals
- Other ministry events

Leader → assigns John to Sunday service
John → receives notification
John → opens service
John → accepts or declines

This gives the leader visibility into who is actually available, and the system can notify volunteers when they are assigned to a service.

Instead of: “Hey John, are you available Sunday?” the scheduling system sends the assignment and lets John respond directly.

## Music Stand integration

The platform connects with Music Stand, which is designed for musicians.

Planning → service flow → Music Stand → musicians prepare and perform

The idea is to build once and reuse the same information across the WorshipTools ecosystem.

Routes:

- `POST /api/auth/signup` (disabled; accounts are administrator-created)
- `POST /api/auth/login`
- `GET /api/choirs/me`
- `GET /api/choirs/:choirId/people`
- `DELETE /api/choirs/:choirId/people/:userId`
- `GET /api/choirs/:choirId/rehearsals`
- `POST /api/choirs/:choirId/rehearsals`
- `PUT /api/choirs/:choirId/rehearsals/:rehearsalId/songs` (administrator/leader setlist management)
- `POST /api/choirs/:choirId/rehearsals/:rehearsalId/attendance`
- `GET /api/choirs/:choirId/attendance/summary`
- `GET /api/choirs/:choirId/attendance/report`
- `GET` and `POST /api/choirs/:choirId/announcements`
- `DELETE /api/choirs/:choirId/announcements/:announcementId`
- `GET /api/choirs/:choirId/reminders`
- `GET` and `POST /api/choirs/:choirId/songs`
- `DELETE /api/choirs/:choirId/songs/:songId`
- `GET` and `POST /api/users`
- `PATCH /api/users/:userId/role`
- `PATCH /api/users/:userId/password` (administrator reset)
- `PATCH /api/users/:userId/password/self`
- `PATCH /api/me/password`
# Backend-Elayone
