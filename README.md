# FundsRoom ERP+CRM

**[🎥 Watch the Full Demo Video Here](https://drive.google.com/file/d/1Dv6dlxCOdwXZ3jvAwsct5nDM2zUGkn0H/view?usp=sharing)**

A full-stack internal operations portal built for managing customers, products (inventory), and sales challans. The system enforces role-based access control across four roles — ADMIN, SALES, WAREHOUSE, and ACCOUNTS — with each role seeing and doing exactly what they're allowed to.

## Architecture

The backend is a Node.js/Express API written in TypeScript, connected to a PostgreSQL database via Prisma ORM. PostgreSQL was chosen for its strong relational guarantees — essential for transactional operations like stock deduction during challan confirmation, where partial failure must roll back the entire operation. Prisma provides type-safe database queries and schema-driven migrations. The database is hosted on [Neon](https://neon.tech) (serverless Postgres) for this demo.

The frontend is a React 19 + Vite + TypeScript SPA styled with Tailwind CSS v4. React Router v7 handles client-side routing with protected routes that redirect unauthenticated users to `/login`. An Axios instance handles all API calls, automatically attaching the JWT from context and intercepting 401 responses to trigger logout. The entire auth state is isolated behind an `AuthContext` so the localStorage dependency is easy to swap in the future.

---

## Tech Stack

| Layer      | Technology |
|------------|-----------|
| Backend    | Node.js, Express 5, TypeScript 5 |
| ORM        | Prisma 5 |
| Database   | PostgreSQL (Neon serverless) |
| Auth       | JWT (`jsonwebtoken`), bcrypt |
| Validation | Zod 4 |
| Storage    | AWS S3 (for Product images) |
| Exports    | PDFKit (for Challan generation) |
| Frontend   | React 19, Vite 8, TypeScript 6 |
| Styling    | Tailwind CSS 4 |
| HTTP client| Axios |
| Routing    | React Router v7 |
| DevOps     | Docker, Docker Compose, GitHub Actions |

---

## Prerequisites

- **Node.js** ≥ 20 (LTS recommended)
- **npm** ≥ 10
- A **PostgreSQL** database (local or Neon/Supabase cloud)
- Git
- Docker & Docker Compose (optional, for containerised setup)

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/vbv0507/vaibhav_fundsroom-erp-crm.git
cd vaibhav_fundsroom-erp-crm
```

### Option A: Running with Docker (Recommended)

You can run the entire stack (Frontend on port 5173, Backend on port 5000) using Docker Compose.

```bash
# First, copy the env files and populate them
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Then start the containers
docker-compose up --build
```
*Note: Make sure your `DATABASE_URL` points to an accessible Postgres instance.*

### Option B: Manual Setup

#### Backend setup

```bash
cd backend
npm install
```

Copy the environment file and fill in your values:

```bash
cp .env.example .env
# Edit .env — see Environment Variables section below
```

Run Prisma migrations to create the database schema:

```bash
npx prisma migrate dev
```

Seed the database with one test user per role:

```bash
npx prisma db seed
```

The seed script will print all four sets of credentials to the console.

Start the backend dev server:

```bash
npm run dev
# Server starts on PORT (default 5000)
```

#### Frontend setup

```bash
cd ../frontend
npm install
```

Copy the environment file:

```bash
cp .env.example .env
# Edit .env — see Environment Variables section below
```

Start the Vite dev server:

```bash
npm run dev
# Frontend starts on http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable       | Description                                                    | Example |
|----------------|----------------------------------------------------------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Prisma format)                   | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET`   | Secret key used to sign and verify JWTs. Use a long random string. | `some_long_random_secret` |
| `PORT`         | HTTP port the Express server listens on                        | `5000` |
| `AWS_ACCESS_KEY_ID` | (Optional) AWS IAM Access Key for S3 product image uploads | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | (Optional) AWS IAM Secret Key for S3 | `xyz123...` |
| `AWS_REGION`   | (Optional) AWS Region for S3 bucket | `ap-south-1` |
| `S3_BUCKET_NAME`| (Optional) AWS S3 Bucket Name | `my-erp-products` |

### Frontend (`frontend/.env`)

| Variable       | Description                                        | Example |
|----------------|----------------------------------------------------|---------|
| `VITE_API_URL` | Base URL of the backend API (no trailing slash)    | `http://localhost:5000` |

> **Never commit real secret values.** The `.env` files are listed in `.gitignore`. Use `.env.example` as a template only.

---

## Test Login Credentials

These are created by the seed script (`npx prisma db seed`). All use the same password.

| Role        | Email                     | Password      |
|-------------|---------------------------|---------------|
| ADMIN       | admin@example.com         | password123   |
| SALES       | sales@example.com         | password123   |
| WAREHOUSE   | warehouse@example.com     | password123   |
| ACCOUNTS    | accounts@example.com      | password123   |

---

## Role Permissions Summary

| Action                        | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
|-------------------------------|:-----:|:-----:|:---------:|:--------:|
| Manage Users                  | ✅    | ❌    | ❌        | ❌       |
| View customers                | ✅    | ✅    | ✅        | ✅       |
| Create / edit customers       | ✅    | ✅    | ❌        | ❌       |
| Add customer notes            | ✅    | ✅    | ❌        | ❌       |
| View products                 | ✅    | ✅    | ✅        | ✅       |
| Create / edit products        | ✅    | ❌    | ✅        | ❌       |
| Upload Product Images to S3   | ✅    | ❌    | ✅        | ❌       |
| Record stock movements        | ✅    | ❌    | ✅        | ❌       |
| View challans                 | ✅    | ✅    | ✅        | ✅       |
| Create / confirm / cancel challans | ✅ | ✅  | ❌        | ❌       |
| Export Challan PDF            | ✅    | ✅    | ✅        | ✅       |

---

## API Documentation

A Postman collection covering all API endpoints is included at the project root:

**`postman_collection.json`** (Postman v2.1 format)

### Importing into Postman

1. Open Postman → **Import** → select `postman_collection.json`
2. Create a Postman environment with two variables:
   - `baseUrl` → `http://localhost:5000` (or your deployed URL)
   - `token` → _(leave blank — the Login request auto-fills this via a test script)_
3. Run **POST /auth/login** first — the token is automatically saved to the `token` variable for all subsequent requests.

### Endpoints overview

| Group     | Method | Path                          | Roles allowed |
|-----------|--------|-------------------------------|---------------|
| Auth      | POST   | `/auth/login`                 | —             |
| Auth      | GET    | `/auth/me`                    | All           |
| Users     | GET    | `/users`                      | ADMIN         |
| Users     | POST   | `/users`                      | ADMIN         |
| Users     | PUT    | `/users/:id`                  | ADMIN         |
| Users     | DELETE | `/users/:id`                  | ADMIN         |
| Customers | POST   | `/customers`                  | ADMIN, SALES  |
| Customers | GET    | `/customers`                  | All           |
| Customers | GET    | `/customers/:id`              | All           |
| Customers | PUT    | `/customers/:id`              | ADMIN, SALES  |
| Customers | POST   | `/customers/:id/notes`        | ADMIN, SALES  |
| Products  | POST   | `/products`                   | ADMIN, WAREHOUSE |
| Products  | GET    | `/products`                   | All           |
| Products  | GET    | `/products/:id`               | All           |
| Products  | PUT    | `/products/:id`               | ADMIN, WAREHOUSE |
| Products  | POST   | `/products/:id/stock-movement`| ADMIN, WAREHOUSE |
| Products  | POST   | `/products/:id/image`         | ADMIN, WAREHOUSE |
| Products  | DELETE | `/products/:id/image`         | ADMIN, WAREHOUSE |
| Challans  | POST   | `/challans`                   | ADMIN, SALES  |
| Challans  | GET    | `/challans`                   | All           |
| Challans  | GET    | `/challans/:id`               | All           |
| Challans  | GET    | `/challans/:id/pdf`           | All           |
| Challans  | PUT    | `/challans/:id/confirm`       | ADMIN, SALES  |
| Challans  | PUT    | `/challans/:id/cancel`        | ADMIN, SALES  |

---

## Known Limitations

- **No automated test suite** — correctness was verified through manual TypeScript test scripts. There are no Jest/Vitest unit or integration tests.
- **No email notifications or webhooks** — follow-up date reminders and status-change notifications are not implemented.
- **No refresh tokens** — JWTs are valid for 24 hours; there is no silent refresh mechanism. Users must log in again after expiry.
- **Transaction timeout on Neon cold paths** — Prisma interactive transactions default to a 5-second timeout. Neon's serverless Postgres can exceed this on cold starts. The timeout is set to 15 seconds in `challan.routes.ts` to mitigate this.

---

## Deployment

This project is deployed and live.

- **Database**: Neon (serverless Postgres) — see the Architecture section.
- **Backend**: Deployed to Render as a Web Service.
  - Root directory: `backend`
  - Build command: `npm install && npx prisma generate && npm run build`
  - Start command: `npm start`
  - Environment variables set in Render dashboard: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and AWS keys.
  - *Note*: The free tier spins down after inactivity. A GitHub Actions keep-alive workflow (`.github/workflows/keep-alive.yml`) pings the `/health` endpoint every 5 minutes to reduce cold starts.
- **Frontend**: Deployed to Vercel.
  - Root directory: `frontend`
  - Framework auto-detected as Vite.
  - Environment variable: `VITE_API_URL` set to the deployed Render backend URL.
  - Includes a `vercel.json` rewrite rule to support client-side routing (React Router) on direct URL navigation.

---

## Project Structure

```
vaibhav_fundsroom-erp-crm/
├── backend/
│   ├── prisma/             # Schema, migrations, seed scripts
│   ├── src/
│   │   ├── index.ts        # Express app entry
│   │   ├── middleware/     # JWT & Role validation
│   │   └── routes/         # Express routes (Auth, Users, Customers, Products, Challans)
│   ├── test-*.ts           # Manual regression scripts
│   ├── .env.example
│   ├── Dockerfile
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/axios.ts    # Axios instance with JWT interceptor
│   │   ├── context/        # Auth Context
│   │   ├── components/     # Reusable UI (Layout, Modals, ProtectedRoutes)
│   │   ├── hooks/          # useDebounce
│   │   ├── pages/          # Page views (Dashboard, Customers, etc.)
│   │   └── types/          # Shared TS interfaces
│   ├── .env.example
│   ├── Dockerfile
│   └── nginx.conf          # Nginx config for Docker
├── docker-compose.yml      # Multi-container orchestration
├── postman_collection.json # API collection (Postman v2.1)
└── README.md
```
