# penny. — expense tracker

A cute, minimalist expense tracking system built with **React + Vite** and a **Node/Express REST API backed by XAMPP MySQL (MariaDB)**.

Track purchases per **weekly session**, see each item's details, category breakdowns, and the week's total in the dashboard.

## Features

- Create a new week (session) with a name, date range, and optional note; rename any week later from its pencil button in the sidebar
- Switch between weeks from the slide-out sidebar — each week keeps its own data
- **General** and **Personal** are separate books; each has its own weeks, expenses, and budgets. Switch between them at the top of the dashboard.
- Log an expense with: item name, category, quantity, unit, unit price, purchase date, and note
- Live total preview while filling in the form (quantity × unit price)
- Edit and delete expenses; delete weeks
- Set a **weekly budget** for each week. The dashboard shows how much is left, a progress bar, and an over-budget warning; it updates as soon as you add, edit, or delete an expense.
- Once a week's end date passes, a wrap-up card at the bottom of that week shows the **money saved** (budget minus spending), or how far over budget you went.
- Dashboard shows total spent, item count, average, biggest purchase, per-category bars, spending-day bars, and a Purchases list that shows only the newest purchase until you expand the scrollable full list grouped by date
- Phone-friendly pastel UI with touch-sized buttons, a slide-out weeks drawer, and bottom-sheet forms
- **Installable PWA** with a service worker, app icon, and offline support: previously viewed weeks/data open without a connection, and changes you make offline are saved on the device and synced automatically when you reconnect
- **Automatic updates on phones**: every push to `main` deploys a newly stamped build; installed apps check for it when they go online or regain focus and refresh themselves to the newest version
- **GitHub Pages ready**: published builds work in local mode with data in the browser, or with a hosted MySQL API if you configure one
- Switch currencies in the app — Philippine peso, Vietnamese dong, South Korean won, Japanese yen, Malaysian ringgit, Indonesian rupiah and many more


## Setup

### 1. Start XAMPP MySQL

Open **XAMPP Control Panel** and click **Start** on **MySQL**. The default credentials are user `root` with an empty password.

> The app connects to `127.0.0.1:3306`. It creates the `expense_tracker` database and its tables automatically on first run.

### 2. Install dependencies

```powershell
cd "C:\Users\Jake Pamotongan\Desktop\Expenses Tracking  System"
npm install
```

### 3. (Optional) configure the database

XAMPP defaults work out of the box. If you changed them, copy `.env.example` to `.env` and edit the values:

```powershell
Copy-Item .env.example .env
```

### 4. Run it

```powershell
npm run dev
```

This starts both servers together:

- React app: **http://localhost:5173**
- API: **http://127.0.0.1:3001**

The app starts empty — create your first week in either the General or Personal book from the sidebar or the dashboard button. Weekly budgets are saved on the device; with a hosted API, weeks and expenses sync but budgets stay local to that browser.

## Install it (PWA)

Open the app in Chrome or Edge on `localhost` (or any HTTPS address). Click the **Install app** button in the dashboard, or use the browser menu → **Install site as app**. It will open in its own window and appear in your Start menu / dock.

> Browsers only allow installation from secure origins (`localhost` counts as secure).

## Working offline

The service worker caches the app shell and API responses, so the dashboard and any weeks you have viewed load without internet. While offline you can still add, edit, and delete expenses and create weeks — changes show up immediately and are queued in `localStorage`. When the connection returns, they sync to MySQL automatically and the dashboard refreshes.

## Publish to GitHub Pages

Push the project to GitHub, go to **Settings → Pages → Source → GitHub Actions**, then push to `main`. The included workflow (`.github/workflows/deploy.yml`) builds and deploys the app automatically. It sets `VITE_BASE_PATH` from your repo name, so project pages like `https://you.github.io/expense-tracker/` work without extra changes.

### How the data works when published

GitHub Pages can only serve static files — it cannot run MySQL or the Express API. Nothing from your PC is exposed. Instead:

- **Default (no setup):** the published app runs in **Local mode**. Weeks and expenses are saved in your browser's `localStorage` and remain available offline. Data is per-browser; clearing site data removes it, and it does not sync between devices.
- **Optional hosted MySQL:** deploy the `server/` folder to a cloud host with a managed MySQL database, set a repository variable `VITE_API_BASE_URL` to that API (e.g. `https://your-api.onrender.com/api`), and set `ALLOWED_ORIGINS` on the server to your GitHub Pages URL. The same React app then uses MySQL, with CORS restricted to your site. The service worker still caches views for offline use, and offline changes queue and sync on reconnect.

To deploy the API yourself, run `npm start` on the host with these environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`, and `ALLOWED_ORIGINS`. The server creates its schema on first run, exactly as it does with XAMPP locally.

### Automatic updates after a push

The deploy workflow writes a fresh `public/version.json` (commit SHA + build time) before building, so every push produces a different service worker. Installed apps check for that new worker when they come back online, when they regain focus, and periodically while open. New workers activate immediately and the app reloads onto the new version — no reinstall or manual refresh needed. While you are typing in a form, the reload waits until you leave the field.

## Other commands

```powershell
npm run build   # production build into dist/ (includes the service worker + manifest)
npm start       # serve the built app + API from http://localhost:3001
npm run icons   # regenerate app icons after editing public/icon.svg
```

## Changing the currency

Use the **wallet selector** in the dashboard header. All totals, charts, expense rows and the price input update instantly, and your choice is saved on this device (so it survives reloads and works offline).

Supported: USD, PHP (peso), VND (dong), KRW (won), JPY (yen), MYR (ringgit), IDR (rupiah), SGD, THB, INR, CNY, EUR, GBP, AUD, CAD, BRL, HKD, TWD, MXN and NZD. Zero-decimal currencies such as dong, won, yen and rupiah are formatted without cents.

This changes how amounts are **displayed**, not their value — switching from `$10` to `₱10` does not convert the amount. To change the starting currency for fresh installs, edit `DEFAULT_CURRENCY` in `src/config.js`.

## Database layout

- `sessions`: `id`, `name`, `scope` (`general` or `personal`), `week_start`, `week_end`, `note`, `created_at`
- `expenses`: `id`, `session_id` (foreign key), `item_name`, `category`, `quantity`, `unit`, `unit_price`, `amount`, `purchased_at`, `note`, `created_at`

Schema: `server/schema.sql`. Deleting a week cascades to its expenses.
