# IND64 Artist Booking Marketplace - Backend (Phase 1 Foundation & Phase 2 Catalog)

Backend for the IND64 artist booking marketplace built on Next.js 15 App Router, TypeScript, PostgreSQL, and Drizzle ORM.

## Prerequisites

- Node.js >= 20 (v22 recommended)
- Docker & Docker Compose (or a local PostgreSQL 16 instance)

---

## 1. Setup & Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Review and adjust secrets and database URL in `.env`. Note the distinction between the development database (`ind64_dev`) and test database (`ind64_test`):
   ```ini
   # Development Database
   DATABASE_URL=postgresql://ind64:ind64_secret_test_password@localhost:5433/ind64_dev

   NODE_ENV=development
   PORT=3000
   OTP_HMAC_SECRET=ind64_super_secret_otp_hmac_key_at_least_32_chars
   SESSION_SECRET=ind64_super_secret_session_encryption_key_32_chars
   APP_ORIGIN=http://localhost:3000
   STORAGE_DRIVER=fake
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

---

## 2. Start PostgreSQL & Run Migrations

Start the dedicated PostgreSQL 16 container on port 5433 (creates both `ind64_dev` and `ind64_test` via initialization script):
```bash
npm run db:up
```

Run Drizzle database migrations against the development database:
```bash
npm run db:migrate
```

To stop the database container when finished:
```bash
npm run db:down
```

---

## 3. Running Tests

Run the full Vitest suite (all 52 tests across 15 unit and integration test files):
```bash
npm test
```

Run only unit tests:
```bash
npm run test:unit
```

Run only integration tests:
```bash
npm run test:int
```

Type checking:
```bash
npx tsc --noEmit
```

---

## 4. Starting the Development Server

Start the Next.js development server on port 3000:
```bash
npm run dev
```

---

## 5. Phase 1: Authentication & Session Endpoints

When running in `development` or `test` mode, OTP codes are held by the in-memory `FakeSmsAdapter` and exposed at `GET /api/__dev/last-otp?phone=...` (or `GET /api/dev-tools/last-otp?phone=...`). (Returns 404 in `production`).

### Step 1: Request an OTP Challenge
```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/challenges \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```
*Sample Response:*
```json
{
  "data": {
    "challengeId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "expiresInSeconds": 300,
    "resendCooldownSeconds": 60
  },
  "requestId": "req_..."
}
```

### Step 2: Fetch the OTP Code (Dev Endpoint)
```bash
curl -X GET "http://localhost:3000/api/__dev/last-otp?phone=%2B919876543210"
```
*Sample Response:*
```json
{
  "phone": "+919876543210",
  "code": "481923"
}
```

### Step 3: Verify the OTP Challenge & Receive Session Cookie
Replace `<CHALLENGE_ID>` and `<CODE>` with values from Step 1 and 2:
```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/challenges/<CHALLENGE_ID>/verify \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"code": "<CODE>"}'
```
*Sample Response:*
```json
{
  "data": {
    "user": {
      "id": "u123...",
      "phone": "+919876543210",
      "name": null,
      "status": "active",
      "memberships": [
        {
          "role": "customer",
          "approvalState": "approved"
        }
      ]
    },
    "csrfToken": "csrf_token_hex_string",
    "onboardingState": {
      "hasCompletedProfile": false
    }
  },
  "requestId": "req_..."
}
```

### Step 4: Inspect Authenticated Session
```bash
curl -X GET http://localhost:3000/api/v1/auth/session \
  -b cookies.txt
```

### Step 5: Update Allowlisted Profile Fields (requires CSRF Token)
```bash
curl -X PATCH http://localhost:3000/api/v1/me \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <CSRF_TOKEN>" \
  -H "Origin: http://localhost:3000" \
  -b cookies.txt \
  -d '{"name": "Janaki Makesh"}'
```

### Step 6: Revoke Session (Logout)
```bash
curl -X DELETE http://localhost:3000/api/v1/auth/session \
  -H "X-CSRF-Token: <CSRF_TOKEN>" \
  -H "Origin: http://localhost:3000" \
  -b cookies.txt \
  -c cookies.txt
```

---

## 6. Phase 2: Catalog & Onboarding Endpoints

### Public Catalog Discovery
- `GET /api/v1/categories`: List active catalog categories.
- `GET /api/v1/locations`: List active service locations / cities.
- `GET /api/v1/artists`: Search published artists with query parameters:
  - `category` (slug string)
  - `city` (string)
  - `q` (text search query)
  - `minPriceMinor` / `maxPriceMinor` (integer in paise)
  - `cursor` (opaque pagination cursor)
  - `limit` (1-50, default 20)
- `GET /api/v1/artists/{slug}`: Get full public profile, active packages, media assets, and categories for a published artist.
- `GET /api/v1/artists/{id}/availability`: Get advisory availability (instant/enquire/unavailable) for a given date range.

### Artist Onboarding & Profile Management (Requires Authentication)
- `POST /api/v1/artist-applications`: Submit an artist onboarding application (draft profile created automatically).
- `GET /api/v1/me/artist-application`: Fetch the current user's submitted application.
- `GET /api/v1/me/artist-profile`: Fetch the current user's artist profile (auto-initialized as `draft` if absent).
- `PATCH /api/v1/me/artist-profile`: Update draft profile fields (stage name, bio, city, base price, categories).
- `POST /api/v1/me/artist-profile/submit`: Validate and transition profile from `draft` to `submitted` for admin review.
- `GET /api/v1/me/artist-packages`: List all active packages for the authenticated artist.
- `POST /api/v1/me/artist-packages`: Create a new package (`name`, `description`, `priceMinor`, `durationMinutes`, `inclusions`, `exclusions`).
- `PATCH /api/v1/me/artist-packages/{id}`: Update an existing package owned by the authenticated artist.
- `DELETE /api/v1/me/artist-packages/{id}`: Soft-delete a package owned by the authenticated artist.

### Customer Shortlist (Requires Authentication)
- `GET /api/v1/me/shortlist`: Get the user's shortlisted artists (with cursor pagination).
- `GET /api/v1/me/shortlist/{artistId}`: Check if an artist is in the user's shortlist (`{ isShortlisted: boolean }`).
- `PUT /api/v1/me/shortlist/{artistId}`: Idempotently add an artist to the shortlist.
- `DELETE /api/v1/me/shortlist/{artistId}`: Remove an artist from the shortlist.

### Presigned Media Storage (Requires Authentication)
- `POST /api/v1/media/uploads`: Request presigned upload URL and S3/Storage intent (`purpose`, `contentType`, `fileSizeBytes`, `filename`).
- `POST /api/v1/media/uploads/{id}/complete`: Verify upload completion and link the media asset to the artist profile.
