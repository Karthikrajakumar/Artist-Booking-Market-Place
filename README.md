# IND64 Artist Booking Marketplace - Backend (Phase 1 Foundation)

Backend foundation for the IND64 artist booking marketplace built on Next.js 15 App Router, TypeScript, PostgreSQL, and Drizzle ORM.

## Prerequisites

- Node.js >= 20 (v22 recommended)
- Docker & Docker Compose (or a local PostgreSQL 16 instance)

---

## 1. Setup & Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Review and adjust secrets and database URL in `.env`:
   ```ini
   DATABASE_URL=postgresql://ind64:ind64_secret_test_password@localhost:5433/ind64_test
   NODE_ENV=development
   PORT=3000
   OTP_HMAC_SECRET=ind64_super_secret_otp_hmac_key_at_least_32_chars
   SESSION_SECRET=ind64_super_secret_session_encryption_key_32_chars
   APP_ORIGIN=http://localhost:3000
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

---

## 2. Start PostgreSQL & Run Migrations

Start the dedicated PostgreSQL 16 container (port 5433):
```bash
npm run db:up
```

Run Drizzle database migrations:
```bash
npm run db:migrate
```

To stop the database container when finished:
```bash
npm run db:down
```

---

## 3. Running Tests

Run the full Vitest suite (19 tests):
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

---

## 4. Starting the Development Server

Start the Next.js development server on port 3000:
```bash
npm run dev
```

---

## 5. End-to-End Authentication Flow via `curl`

When running in `development` or `test` mode, OTP codes are held by the in-memory `FakeSmsAdapter` and exposed at `GET /api/__dev/last-otp?phone=...`. (This route returns 404 in `production`).

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
    "isNewUser": true
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
