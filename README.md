# Trade Shield Africa

Kenya-first digital investment website risk intelligence. The product is evidence-led: external signals and technical observations feed a deterministic risk score; AI is limited to explanation and cannot change evidence or score.

## Current implementation

- Responsive Next.js landing and assessment preview, including reduced-motion-aware Three.js shield, address-format validation, evidence methodology, a paid consultancy inquiry form, and disclaimer.
- FastAPI service with account registration/login/logout, owner-scoped scans, consultation persistence, M-Pesa checkout and Paystack payment verification, evidence collection, separate risk/confidence calculations, SSRF-resistant public-page fetch, provider adapters and optional OpenAI summary.
- Private site-report intake, role-guarded editorial moderation, and a public News & Updates section for source-cited articles.
- SQLite is the local default; production deployments should configure Neon using `postgresql+asyncpg` and Alembic migrations.

This is a development foundation, not a production launch. The browser preview does not submit scans or charge for assessments. Paid consultation questions are stored, but no staff notification or fulfillment workflow is configured. PDF reports and report verification, AI chat, a production job queue, rate limiting, and deployment-grade migrations/monitoring still need implementation and security review. Public report intake should be rate-limited before launch. External provider credentials and maintained official Kenyan register feeds are not included. An absent regulatory match is never treated as proof of fraud.

## Prerequisites

- Node.js 20.9 or newer and npm.
- Python 3.12 or newer.
- A Neon PostgreSQL database for production; local SQLite is used by default.

## Run locally

Copy `.env.example` to `.env` and set backend credentials only when testing those integrations. Keep real secrets out of source control.

To enable live website-assessment and consultation M-Pesa checkout, set your Paystack live secret key (`sk_live_...`) as `PAYSTACK_SECRET_KEY` in the root `.env`. The current server-side M-Pesa flow does not use a Paystack public key; never expose the secret through a `NEXT_PUBLIC_` variable. Without the secret, checkout stays disabled.

In the Paystack dashboard, enable the Kenya M-Pesa channel and configure the webhook URL as `https://<your-api-host>/api/v1/payments/webhook`. Paystack needs a publicly reachable HTTPS URL to deliver production webhooks; local checkout status is also verified directly by the API.

Install and run the frontend:

```powershell
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

Run the API from the `backend` directory:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API health check is `http://localhost:8000/healthz`; interactive API docs are at `http://localhost:8000/docs`.

## Deploy frontend and backend

Deploy the repository root as a Next.js project on Vercel. The root `vercel.json` pins the framework and build commands; keep the Vercel Root Directory set to `.`.

Deploy the FastAPI service and PostgreSQL database from `render.yaml` on Render. During setup, set `FRONTEND_URL` and `APP_URL` to the Vercel site's origin (for example, `https://your-project.vercel.app`). Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` to unique credentials. The blueprint's free service/database plans are for evaluation and may sleep or have storage limits; choose appropriate paid plans for a production service.

In Vercel Project Settings > Environment Variables, set `NEXT_PUBLIC_API_URL` to the Render API origin, such as `https://tradeshield-api.onrender.com` (the frontend adds `/api/v1` automatically). Redeploy the Vercel project after setting it. Add `PAYSTACK_SECRET_KEY` and any optional provider keys to the Render service only; never expose backend secrets through `NEXT_PUBLIC_*` variables.

For reliable account sessions, use custom frontend and API hostnames under the same registrable domain (for example, `www.example.com` and `api.example.com`). The default Vercel and Render hostnames are cross-site, while the current session cookie is `SameSite=Lax`.

Run backend tests from `backend`:

```powershell
python -m pytest
```

## Admin access

The dashboard at `/admin` is not linked from public navigation. Its dedicated login uses backend-only `ADMIN_USERNAME` and `ADMIN_PASSWORD` settings from the ignored root `.env.admin` file; the API creates the corresponding `ADMIN` account on startup. Keep `.env.admin` private and use a strong, unique password in deployed environments. Admins can review private reports, save article drafts, and publish only after adding source URLs and confirming that sources and claims were reviewed. Public posts are evidence-based information, not legal findings that an entity is fraudulent.

## Security notes

- URL fetches allow HTTP/HTTPS only, validate DNS results, reject non-public addresses, pin each resolved host, constrain redirects, apply timeouts and cap response bytes.
- Payment activation depends on server-side Paystack verification of reference, transaction status, KES amount, currency and scan metadata. Webhook signatures are compared in constant time.
- Consultation checkout uses Paystack's Kenya M-Pesa STK flow; the server verifies the amount, currency, provider and consultation metadata before marking a request paid.
- Configure `JWT_SECRET_KEY` with a cryptographically random secret and set `APP_URL` to HTTPS in deployed environments so auth cookies are Secure.
- Replace local `create_all` initialization with reviewed Alembic migrations before deployment. Add distributed rate limiting, background workers, audit retention policy, object storage, operational alerts and an independent SSRF/payment/authentication assessment before accepting real customers.
