# Local Development Guide

This guide explains how to spin up the AutoReach stack on your local machine for development and testing.

## Prerequisites
- **Node.js** (v20+ recommended)
- **PostgreSQL** (installed locally or running via Docker)
- **Git**

## 1. Setup Local Database

You need a running PostgreSQL instance. If you have Docker installed locally, you can start one quickly:

```bash
docker run --name autoreach-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16-alpine
```

This gives you a connection string: `postgresql://postgres:postgres@localhost:5432/postgres?schema=public`

## 2. Start the Express API (`api/`)

The API handles database connections, background cron jobs, and webhook receiving.

1. **Install dependencies**:
   ```bash
   cd api
   npm install
   ```

2. **Configure Environment Variables**:
   Create an `.env` file in the `api/` folder:
   ```env
   NODE_ENV=development
   PORT=3070
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
   APP_BASE_URL="http://localhost:3040"
   ENCRYPTION_KEY="32_CHARACTER_RANDOM_STRING_HERE"
   ```

3. **Migrate the Database**:
   Apply the database schema to your local Postgres:
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   *The API is now running on `http://localhost:3070`.*

## 3. Start the Next.js Dashboard (`dashboard/`)

The dashboard is the frontend UI where users view leads and configure settings.

1. **Install dependencies**:
   ```bash
   cd dashboard
   npm install
   ```

2. **Configure Environment Variables**:
   Create an `.env` file in the `dashboard/` folder:
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:3070/api"
   NEXTAUTH_URL="http://localhost:3040"
   NEXTAUTH_SECRET="local_dev_secret"

   # You can leave these blank for local dev if testing with email/password
   GITHUB_CLIENT_ID=""
   GITHUB_CLIENT_SECRET=""
   GOOGLE_CLIENT_ID=""
   GOOGLE_CLIENT_SECRET=""
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev -- -p 3040
   ```
   *The Dashboard is now running on `http://localhost:3040`.*

## 4. Development Workflow

1. Open `http://localhost:3040` in your browser.
2. Sign up for a new account (this saves to your local database).
3. If you make changes to the Prisma schema (`api/prisma/schema.prisma`), remember to run:
   ```bash
   npx prisma migrate dev --name describe_change
   ```
   Then run `npx prisma generate` in **both** the `api/` and `dashboard/` folders to update the TypeScript types.
