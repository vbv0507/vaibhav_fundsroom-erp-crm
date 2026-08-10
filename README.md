# FundsRoom ERP+CRM

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
| Frontend   | React 19, Vite 8, TypeScript 6 |
| Styling    | Tailwind CSS 4 |
| HTTP client| Axios |
| Routing    | React Router v7 |

---

## Prerequisites

- **Node.js** ≥ 20 (LTS recommended)
- **npm** ≥ 10
- A **PostgreSQL** database (local or Neon/Supabase cloud)
- Git

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/vbv0507/vaibhav_fundsroom-erp-crm.git
cd vaibhav_fundsroom-erp-crm
```

### 2. Backend setup

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

### 3. Frontend setup

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
| `JWT_SECRET`   | Secret key used to sign and verify JWTs. Use a long random string in production. | `some_long_random_secret` |
| `PORT`         | HTTP port the Express server listens on                        | `5000` |

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
| View customers                | ✅    | ✅    | ✅        | ✅       |
| Create / edit customers       | ✅    | ✅    | ❌        | ❌       |
| Add customer notes            | ✅    | ✅    | ❌        | ❌       |
| View products                 | ✅    | ✅    | ✅        | ✅       |
| Create / edit products        | ✅    | ❌    | ✅        | ❌       |
| Record stock movements        | ✅    | ❌    | ✅        | ❌       |
| View challans                 | ✅    | ✅    | ✅        | ✅       |
| Create / confirm / cancel challans | ✅ | ✅  | ❌        | ❌       |

---

## API Documentation

A Postman collection covering all 17 API endpoints is included at the project root:

**`postman_collection.json`** (Postman v2.1 format)

### Importing into Postman

1. Open Postman → **Import** → select `postman_collection.json`
2. Create a Postman environment with two variables:
   - `baseUrl` → `http://localhost:5000` (or your deployed URL)
   - `token` → _(leave blank — the Login request auto-fills this via a test script)_
3. Run **POST /auth/login** first — the token is automatically saved to the `token` variable for all subsequent requests.

### Endpoints overview

| Group     | Method | Path                          | Auth required | Roles allowed |
|-----------|--------|-------------------------------|:-------------:|---------------|
| Auth      | POST   | `/auth/login`                 | No            | —             |
| Auth      | GET    | `/auth/me`                    | Yes           | All           |
| Customers | POST   | `/customers`                  | Yes           | ADMIN, SALES  |
| Customers | GET    | `/customers`                  | Yes           | All           |
| Customers | GET    | `/customers/:id`              | Yes           | All           |
| Customers | PUT    | `/customers/:id`              | Yes           | ADMIN, SALES  |
| Customers | POST   | `/customers/:id/notes`        | Yes           | ADMIN, SALES  |
| Products  | POST   | `/products`                   | Yes           | ADMIN, WAREHOUSE |
| Products  | GET    | `/products`                   | Yes           | All           |
| Products  | GET    | `/products/:id`               | Yes           | All           |
| Products  | PUT    | `/products/:id`               | Yes           | ADMIN, WAREHOUSE |
| Products  | POST   | `/products/:id/stock-movement`| Yes           | ADMIN, WAREHOUSE |
| Challans  | POST   | `/challans`                   | Yes           | ADMIN, SALES  |
| Challans  | GET    | `/challans`                   | Yes           | All           |
| Challans  | GET    | `/challans/:id`               | Yes           | All           |
| Challans  | PUT    | `/challans/:id/confirm`       | Yes           | ADMIN, SALES  |
| Challans  | PUT    | `/challans/:id/cancel`        | Yes           | ADMIN, SALES  |

---

## Known Limitations

- **No Docker / containerisation** — the project runs purely via `npm run dev` locally. A `Dockerfile` and `docker-compose.yml` are not included.
- **No automated test suite** — correctness was verified through manual TypeScript test scripts (`test-auth.ts`, `test-crm.ts`, `test-product.ts`, `test-challan.ts` in `/backend`). There are no Jest/Vitest unit or integration tests.
- **No AWS / cloud deployment** — see the Deployment section below.
- **No email notifications or webhooks** — follow-up date reminders and status-change notifications are not implemented.
- **No file uploads** — customer documents, product images, and challan PDFs are out of scope.
- **No refresh tokens** — JWTs are valid for 24 hours; there is no silent refresh mechanism. Users must log in again after expiry.
- **Transaction timeout on Neon cold paths** — Prisma interactive transactions default to a 5-second timeout. Neon's serverless Postgres can exceed this on cold starts. The timeout is set to 15 seconds in `challan.routes.ts` to mitigate this.
- **Frontend-only** — the Challans page's Postman collection and the stock movement detail panel are read-only for WAREHOUSE and ACCOUNTS; no challan PDF export is implemented.

---

## Deployment

> **TODO — Phase 9**
>
> Deployment instructions for the chosen cloud platform (AWS / Railway / Render / Vercel) will be added here in Phase 9, including:
>
> - Backend: containerised Express API deployment
> - Frontend: static build deployment (Vercel / S3 + CloudFront)
> - Database: production Neon project setup
> - CI/CD pipeline configuration
> - Environment variable management in production
> - Domain and HTTPS setup

---

## Project Structure

```
vaibhav_fundsroom-erp-crm/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (User, Customer, Product, Challan…)
│   │   ├── migrations/         # Prisma migration history
│   │   └── seed.ts             # Creates 4 test users (one per role)
│   ├── src/
│   │   ├── index.ts            # Express app entry point
│   │   ├── middleware/
│   │   │   └── auth.ts         # requireAuth + requireRole middleware
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       ├── customer.routes.ts
│   │       ├── product.routes.ts
│   │       └── challan.routes.ts
│   ├── test-auth.ts            # Auth regression test script
│   ├── test-crm.ts             # Customer module regression test script
│   ├── test-product.ts         # Product module regression test script
│   ├── test-challan.ts         # Challan module regression test script
│   ├── .env.example
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/axios.ts        # Axios instance with JWT interceptor
│   │   ├── context/AuthContext.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx      # Sidebar + topbar shell
│   │   │   ├── Modal.tsx       # Reusable modal
│   │   │   └── ProtectedRoute.tsx
│   │   ├── hooks/useDebounce.ts
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Products.tsx
│   │   │   └── Challans.tsx
│   │   └── types/index.ts      # Shared TypeScript types
│   ├── .env.example
│   └── tsconfig.app.json
├── postman_collection.json     # API collection (Postman v2.1)
└── README.md
```
