# Project Journey — FundsRoom ERP+CRM

Engineering notes documenting each development phase, the decisions made, and the real issues encountered and resolved. Written as a factual record of the build process, not a feature summary.

---

## Phase 0 — Project Scaffolding & Frontend Tooling

**What was built:** Initialized the monorepo structure with `/backend` (Express + TypeScript) and `/frontend` (React + Vite + TypeScript). Set up Prisma with the initial schema, configured `ts-node-dev` for the backend dev loop, and wired up Tailwind CSS on the frontend.

**Issues encountered:**

Tailwind CSS v4 broke from the v3 configuration model. The project was initialized with Tailwind v4, but the standard `@tailwind base/components/utilities` directives in `index.css` produced no output — v4 no longer uses that directive syntax and requires the new `@import "tailwindcss"` approach. Additionally, v4's PostCSS integration ships as a separate package (`@tailwindcss/postcss`) instead of being bundled with the main package, so `postcss.config.js` had to explicitly reference that adapter rather than the old `tailwindcss` plugin key.

A second issue surfaced as a TypeScript compile error (`TS6133: 'React' is declared but its value is never read`) on `import React from 'react'` in a component file. React 17+ JSX transform no longer requires the React import in scope, but `tsconfig.json` had `"jsx": "react-jsx"` which makes the import redundant — the TypeScript strict mode flag `noUnusedLocals` then treated it as an error. Fixed by removing the unused import.

---

## Phase 1 — Authentication Backend

**What was built:** `POST /auth/login` and `GET /auth/me` routes using JWT (`jsonwebtoken`) and bcrypt. A `requireAuth` middleware that validates the Bearer token on every protected route, and a `requireRole` middleware factory for role-based access. Database seeded with four users, one per role (ADMIN, SALES, WAREHOUSE, ACCOUNTS).

**Issues encountered:**

The Zod version installed (v4.x) renamed the property for accessing validation error details from `.errors` to `.issues` on a `ZodError` object. The route code was initially written using `parseResult.error.errors`, which compiled fine under `ts-node-dev --transpile-only` (that flag skips type checking to speed up restarts) but produced a `TS2339: Property 'errors' does not exist on type 'ZodError'` error as soon as `npx tsc --noEmit` was run directly. The fix was a one-character property rename, but it highlighted a key risk of `transpile-only` mode: type errors in production-path code go undetected during development unless a separate type-check step is run explicitly.

---

## Phase 2 — Customer CRM Module

**What was built:** Five customer routes (`POST`, `GET` list with pagination/search/filter, `GET /:id`, `PUT /:id`, `POST /:id/notes`) with full Zod validation and role-based write restrictions (ADMIN and SALES only for mutations). The `CustomerNote` model was added to `schema.prisma` to give each customer an append-only notes history with authorship tracking.

**Issues encountered:**

After adding `CustomerNote` to `schema.prisma` and running `prisma migrate dev`, the TypeScript compiler reported six errors in `customer.routes.ts`: `Property 'customerNote' does not exist on type 'PrismaClient'` and `'notes' does not exist in type 'CustomerInclude'`. The migration had applied successfully at the database level, but the Prisma Client TypeScript types are generated separately from the migration and were still reflecting the old schema. Running `npx prisma generate` regenerated the client types, but the VS Code TypeScript language server had cached the old types — a full TypeScript server restart (via the command palette) was required before the errors cleared. The lesson: `prisma migrate dev` runs the SQL but does not automatically re-run `prisma generate`; in some setups these are separate steps, and a stale generated client can produce type errors that look like schema or code problems when the real issue is just a stale artifact.

---

## Phase 3 — Product & Inventory Module

**What was built:** Five product routes (`POST`, `GET` list with low-stock filter, `GET /:id` including last 20 stock movements, `PUT /:id`, `POST /:id/stock-movement`). The `PUT` route explicitly rejects any request that includes a `currentStock` field to enforce the invariant that stock can only change through tracked `StockMovement` records. The stock movement route is wrapped in a Prisma interactive transaction to atomically update `currentStock` and create the `StockMovement` row.

**Issues encountered:**

No major bugs in this phase. The main design decision was enforcing the "stock via movements only" invariant at the API layer rather than the database layer — there is no database trigger; the route simply checks for the presence of `currentStock` in the request body and returns a `400` with an explicit error message. This is intentional: it makes the constraint visible and debuggable rather than opaque.

---

## Phase 4 — Sales Challan Module

**What was built:** Five challan routes (`POST` creates a DRAFT, `GET` list with filters, `GET /:id`, `PUT /:id/confirm`, `PUT /:id/cancel`). The most critical business rule: when a DRAFT challan is confirmed, the product name, SKU, and unit price are snapshotted into each `ChallanItem` row at that moment, so the challan record is immutable to future product changes. Cancelling a CONFIRMED challan restores stock through the same transaction mechanism used for confirmation.

**Issues encountered:**

The confirm operation touches multiple product rows and creates multiple `StockMovement` records — if any single item check or update fails after others have already been applied, the database would be left in an inconsistent state (some stock deducted, some not). The fix was wrapping the entire confirm logic in a single `prisma.$transaction()` interactive transaction: the stock check loop runs first across all items and accumulates all shortages, and only if zero shortages exist do the updates run. If any database operation inside the transaction throws, Prisma rolls back every change atomically. A later regression issue revealed that Neon's serverless Postgres introduces enough cold-start latency to exceed Prisma's default 5-second interactive transaction timeout, causing `Transaction already closed` errors under load. This was resolved by passing `{ timeout: 15000 }` as the second argument to `$transaction()` in both `challan.routes.ts` and `product.routes.ts`.

---

## Phase 5 — Frontend Auth & App Shell

**What was built:** The React frontend scaffolding: `AuthContext` with JWT persistence to `localStorage`, an Axios instance pre-configured with the `VITE_API_URL` base URL and a response interceptor that redirects to `/login` on any `401`, a `ProtectedRoute` wrapper component, the `Layout` component (sidebar navigation + topbar), and the `Login` page.

**Issues encountered:**

The Axios 401 interceptor initially used React Router's `useNavigate` for redirect, which cannot be called outside a component render cycle. Since the interceptor runs at the module level, `useNavigate` is unavailable there. The fix was using `window.location.href = '/login'` for the redirect, which performs a hard navigation — this also has the desirable side effect of fully clearing React's in-memory state, preventing stale auth data from persisting across sessions.

---

## Phase 6 — Customer & Product Management UI

**What was built:** Full `Customers.tsx` and `Products.tsx` pages replacing the placeholder routes. Both pages include debounced search (using a `useDebounce` hook), filter dropdowns, paginated tables, add/edit modals with Zod-mirrored form validation, and detail views. Products highlights low-stock rows inline. The edit form for products deliberately omits the `currentStock` field to reflect the backend's write restriction. A shared `Modal.tsx` component handles all modal rendering with Escape-to-close and scroll-lock.

**Issues encountered:**

The `Products.tsx` file initially declared a `selectCls` constant that was defined but never referenced — TypeScript's `noUnusedLocals` flag (set in `tsconfig.app.json`) treated this as a compile error (`TS6133`). Removed the unused variable. This is a recurring pattern: strict TypeScript config catches dead code that would silently ship in JavaScript, which is the intended behaviour but requires discipline when scaffolding quickly.

---

## Phase 7 — Challans UI

**What was built:** `Challans.tsx` with a paginated table, status-based filtering, and a customer search dropdown. The "New Challan" modal implements a dynamic multi-line product builder where each line has an independent product search dropdown showing live stock levels. The detail view displays all snapshot data with a visible "🔒 Prices locked at creation time" label to communicate the immutability clearly. The insufficient-stock error path displays per-product shortage details from the `details[]` array in the API response, not a generic message.

**Issues encountered:**

The `SearchDropdown` generic component required `onMouseDown` with `e.preventDefault()` rather than `onClick` for the option buttons. Using `onClick` caused the parent `input`'s `onBlur` event to fire first (closing the dropdown before the click registered), so the selection was never captured. Switching to `onMouseDown` fires before `onBlur`, allowing the selection to complete before the dropdown closes. This is a standard pattern for custom dropdown components in React but easy to miss when building one from scratch.

---

## Phase 8 — Documentation & Regression

**What was built:** `README.md` (setup guide, env vars, credentials, API table, known limitations), `postman_collection.json` (Postman v2.1, all 17 endpoints, `{{baseUrl}}`/`{{token}}` variables, auto-saves token on login via test script), and this file.

**Issues encountered:**

The four test scripts (`test-auth.ts`, `test-crm.ts`, `test-product.ts`, `test-challan.ts`) each declared `const API_URL` and `async function getToken()` at the top level. TypeScript's module resolution treats files without `import` or `export` statements as global scripts rather than isolated modules, causing all four files to share a single global scope — resulting in `Cannot redeclare block-scoped variable 'API_URL'` and `Duplicate function implementation` errors when `tsc --noEmit` checked them together. Adding `export {};` to the top of each file (the minimal declaration needed to make TypeScript treat the file as a module) resolved all six errors with no logic changes.

Running the full regression suite back-to-back also exposed that Neon's free-tier Postgres auto-suspends after a period of inactivity and can take several seconds to resume on the first query — long enough to trigger `Can't reach database server` on the very first request of each test script. Subsequent requests within the same run succeed because the connection is alive. This is a hosting characteristic, not a code defect; the fix is ensuring the DB is warmed before a regression run, or adding retry logic to the test harness. The transaction timeout increase (Phase 4 notes) mitigates the worst case but does not eliminate the cold-start window entirely.
