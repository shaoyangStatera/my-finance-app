# Nestworth

A family finance app — track CPF, housing, savings, investments, and insurance together. Multi-user, family groups, built for couples and families.

## Stack

- **Frontend:** Expo Router (web + iOS + Android)
- **Backend:** Vercel serverless (`/api/*`)
- **Database:** MongoDB Atlas

## Quick start (local)

### 1. Environment

```bash
cp .env.example .env
```

Fill in `MONGODB_URI`, `JWT_SECRET`, and `SETUP_SECRET`.

### 2. Seed database

Creates the shared account + May 2026 sample data:

```bash
npm run seed
```

Default login after seeding:
- **Username:** `felsy`
- **Password:** value of `SEED_PASSWORD` in your `.env`
- **OTP:** emailed to both addresses on every login

## Security

- **Email OTP** on every login — 6-digit code sent to both configured addresses
- **Password reset OTP** — emailed when your password expires (90 days)
- **Rate limits:** 5 failed attempts per 15 minutes on login, OTP, and reset
- **Session timeout:** 8-hour access token; auto sign-out after 30 minutes of inactivity
- **OTP expiry:** 10 minutes to enter the code

### Email setup (required)

OTP emails are sent via **Gmail SMTP** from your configured account.

1. Enable 2-Step Verification on the Gmail account
2. Create an [App Password](https://myaccount.google.com/apppasswords)
3. Add to `.env`:

```
SMTP_USER=chinshaoyang343@gmail.com
SMTP_PASS=your-16-char-app-password
FROM_EMAIL=Felsy Finance <chinshaoyang343@gmail.com>
OTP_RECIPIENTS=chinshaoyang343@gmail.com,feliciakoh120203@gmail.com
```

Add the same variables to Vercel when deploying.

### 3. Run

Terminal 1 — API:
```bash
npm run dev:api
```

Terminal 2 — App:
```bash
npm run web
```

## Shared account model

One login for both of you. Inside the app, data is labelled **Chin** and **Felicia** — income, discretionary spend, CPF, investments, and insurance are tracked separately but editable by either person.

## HDB

Pre-configured for **Alexandra Vista** at `111B Tanglin Rd #24-115 Singapore 242111` with 11% subsidy clawback. The Alexandra Vista brochure PDF is available on the HDB tab and at `/documents/alexandra-vista-brochure.pdf`.

## Deploy to Vercel

1. Push to GitHub
2. Import on Vercel, add env vars (`MONGODB_URI`, `JWT_SECRET`, `SETUP_SECRET`)
3. Run `npm run seed` locally (or deploy first and seed against production URI)
4. Leave `EXPO_PUBLIC_API_URL` empty in production

## App tabs

| Tab | Purpose |
|-----|---------|
| Overview | Monthly snapshot |
| Ledger | Income + expenses (by person) |
| CPF | OA / SA / MA for both |
| HDB | Alexandra Vista tracker + brochure |
| Wealth | Investments + insurance (by person) |
