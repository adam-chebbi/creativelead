# AutoReach Environment Setup Guide

This document provides step-by-step instructions for configuring the `.env` file required for AutoReach. This file contains sensitive information and should **never** be committed to version control.

## Where to put the `.env` file

1. On your local development machine: Create a file named `.env` in the root of the project repository (`autoreach/`).
2. On your production VPS: Create the `.env` file in the root directory where your application is deployed.

You can copy the template provided in `.env.example` to get started:
```bash
cp .env.example .env
```

---

## 1. Database Setup (PostgreSQL & Prisma)

AutoReach uses PostgreSQL as its database, managed via Prisma.

*   `POSTGRES_USER`: Database username (default: `autoreach`).
*   `POSTGRES_PASSWORD`: Make sure to change this to a strong, secure password!
*   `POSTGRES_DB`: Database name (default: `autoreach`).

The Prisma URLs connect the application to the database. If you change the password above, you must update the connection strings here:
*   `DATABASE_URL`: `postgresql://autoreach:<YOUR_STRONG_PASSWORD>@postgres:5432/autoreach`
*   `DIRECT_URL`: `postgresql://autoreach:<YOUR_STRONG_PASSWORD>@postgres:5432/autoreach`

---

## 2. NextAuth Configuration

NextAuth handles session security and authentication.

*   `NEXTAUTH_SECRET`: Used to encrypt the NextAuth.js JWT. You must generate a random string for this.
    *   **How to generate**: Open your terminal and run: `openssl rand -base64 32`
    *   Paste the output as the value for `NEXTAUTH_SECRET`.
*   `NEXTAUTH_URL`: The canonical URL of your site (e.g., `https://leads.creativecomet.tn`). In local development, you might set this to `http://localhost:3000`.

---

## 3. GitHub OAuth Setup

To allow users to log in with GitHub, you need to create an OAuth app in GitHub.

### Step-by-Step GitHub Setup:
1. Go to [GitHub Developer Settings -> OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**.
3. Fill out the application details:
    *   **Application name**: AutoReach (or your preferred name)
    *   **Homepage URL**: `https://leads.creativecomet.tn` (or your domain)
    *   **Authorization callback URL**: `https://leads.creativecomet.tn/api/auth/callback/github` (Ensure `/api/auth/callback/github` is at the end).
4. Click **Register application**.
5. You will see your **Client ID**. Copy this and paste it as `GITHUB_CLIENT_ID` in your `.env` file.
6. Click **Generate a new client secret**. Copy the generated secret and paste it as `GITHUB_CLIENT_SECRET` in your `.env` file. *(Note: You will only see this secret once!)*

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

---

## 4. Google OAuth Setup

To allow users to log in with Google, you need to create OAuth credentials in Google Cloud Platform.

### Step-by-Step Google Setup:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select an existing project or create a **New Project** (e.g., "AutoReach Auth").
3. Go to **APIs & Services > OAuth consent screen**.
    *   Choose **External** user type and click Create.
    *   Fill in the required fields (App Name, User support email, Developer contact information).
    *   Add your authorized domain (e.g., `creativecomet.tn`).
    *   Save and Continue through the scopes and test users sections.
4. Go to **APIs & Services > Credentials** on the left sidebar.
5. Click **Create Credentials** at the top and select **OAuth client ID**.
6. Select **Web application** as the Application type.
7. Fill in the details:
    *   **Name**: AutoReach Web Client
    *   **Authorized JavaScript origins**: Add your domain (e.g., `https://leads.creativecomet.tn`).
    *   **Authorized redirect URIs**: Add `https://leads.creativecomet.tn/api/auth/callback/google`
8. Click **Create**.
9. A modal will pop up with your **Client ID** and **Client Secret**. Copy these into your `.env` file.

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## 5. Security and Encryption

*   `ENCRYPTION_KEY`: Used to securely store user API keys in the database.
    *   **Requirement**: Must be exactly 64 hex characters (32 bytes).
    *   **How to generate**: Open your terminal and run:
        ```bash
        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
        ```
    *   Paste the output as your `ENCRYPTION_KEY`.

*   `WORKER_SECRET`: A shared secret between the background worker (Electron/Python) and the API bridge to ensure only authorized workers can communicate.
    *   **How to generate**: Open your terminal and run: `openssl rand -hex 32`
    *   Paste the output as your `WORKER_SECRET`.

---

## 6. Integrations & API Keys

*   `GROQ_API_KEY`: Default API key for Groq if the user hasn't provided their own (optional, depending on your application logic). Get this from [Groq Console](https://console.groq.com/).

### Email Configuration (Resend)
AutoReach uses Resend to send transactional emails and automated outreach.

*   `RESEND_API_KEY`: Create an API key at [Resend](https://resend.com/api-keys).
*   `RESEND_FROM_EMAIL`: The default address emails will be sent from (e.g., `outreach@leads.creativecomet.tn`). Ensure this domain is verified in Resend.
*   `RESEND_WEBHOOK_SECRET`: Used to securely receive email delivery events from Resend. Find this in the Resend Dashboard under Webhooks after setting one up.

---

## 7. Application Details

*   `APP_BASE_URL`: Your base application URL (e.g., `https://leads.creativecomet.tn`).
*   `NODE_ENV`: Set to `production` on your VPS, or `development` locally.

---

## Appendix: GitHub Actions Secrets

If you are using GitHub Actions for CI/CD deployment, you also need to set these secrets in your GitHub repository (**Settings > Secrets and variables > Actions > New repository secret**):

*   `VPS_HOST`: The IP address of your server (e.g., `54.37.159.215`).
*   `VPS_USER`: The SSH username (e.g., `root`).
*   `VPS_SSH_KEY`: The **private** SSH key that allows access to your VPS.
*   `WORKER_SECRET`: The same `WORKER_SECRET` you generated above. This is injected during the build process.
