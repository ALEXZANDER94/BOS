# BOS — Business Operations Suite

A self-hosted, full-stack business operations platform covering supplier management, price comparison, CRM, and Gmail integration. Built with ASP.NET Core 8 and React 19.

---

## Features

### Supplier & Price Comparison
- Manage suppliers with domain and contact information
- Define per-supplier comparison criteria for uploaded price sheets
- Upload supplier price sheets as **PDF** (via Adobe PDF Services conversion) or **XLSX/CSV**
- Automatically map columns and normalize prices to a per-unit basis
- Compare uploaded prices against a master glossary to surface savings
- Generate downloadable comparison reports

### Glossary
- Maintain a master catalog of items with contracted prices and unit metrics
- Assign user-defined statuses to glossary entries (e.g. Active, Discontinued, On Hold)
- Search by catalog number, description, or manufacturer

### CRM
- **Clients** — track companies with domain, industry, website, and address
- **Contacts** — link contacts to clients with email, phone, and title
- **Projects** — associate projects with clients and contacts, track status
- **Activity Logs** — record notes and activity against client records

### Email (Gmail Integration)
- Sign in with Google to connect your Gmail account (read-only access)
- View and read emails directly within BOS
- **Filter by client** — automatically surfaces emails matching a client's domain and contacts
- **Filter by alias** — detect Google Workspace email aliases via the Admin SDK and filter the inbox by them
- **Filter by category** — assign user-defined categories to emails and view them as a faceted list
- **Search** — search across subject, sender, and body content via Gmail's native search
- **Email categories** — user-defined top-level classifications (e.g. Invoice, Scheduling, Proposal) with colored badges
- **Category statuses** — user-defined workflow statuses scoped to each category (e.g. On-Hold, Processing, Completed)
- Assign and reassign categories and statuses to emails in real time
- Drafts are automatically excluded from all email views

### Settings
- Configure Adobe PDF Services credentials
- Manage application-wide settings

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 8, C#, Entity Framework Core, SQLite |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix UI |
| Auth | Google OAuth 2.0 (cookie-based session) |
| Email | Gmail API (read-only), Google Admin SDK Directory API |
| PDF | Adobe PDF Services SDK |

---

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- A **Google Cloud project** with a configured OAuth consent screen
- A **Google Workspace** account (required for alias detection via the Admin SDK)
- An **Adobe PDF Services** account (required for PDF price sheet uploads; optional otherwise)

---

## Google Cloud Console Setup

### 1. Enable APIs

In your Google Cloud project, enable the following APIs:

- **Gmail API**
- **Admin SDK API**

### 2. OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Add an authorised redirect URI:
   - Development: `http://localhost:5000/api/auth/callback`
   - Production: `https://yourdomain.com/api/auth/callback`
4. Note the **Client ID** and **Client Secret**

### 3. OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Add the following scopes:
   - `openid`, `profile`, `email` (default)
   - `https://www.googleapis.com/auth/gmail.readonly`
3. If your app is **External**, publish it and submit for Google verification. If it is **Internal** (Workspace organisation only), no verification is required.

### 4. Service Account (Alias Detection)

1. Go to **IAM & Admin → Service Accounts → Create Service Account**
2. Name it (e.g. `BOS Directory Reader`); do not assign any project-level roles
3. Open the created service account, go to **Keys → Add Key → Create new key → JSON**, and download the file
4. Note the **Unique ID** displayed on the service account details page — this is the OAuth Client ID used in the next step

---

## Google Workspace Admin Console Setup

> Requires a Super Admin account.

1. Go to **Security → Access and data control → API controls → Manage Domain Wide Delegation**
2. Click **Add new**
3. Enter the service account **Unique ID** (from step 4 above) as the Client ID
4. Add the scope: `https://www.googleapis.com/auth/admin.directory.user.alias.readonly`
5. Click **Authorize**

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/bos.git
cd bos
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 3. Configure the backend

The `backend/appsettings.json` file contains the configuration schema with empty values. Do not add credentials directly to this file. Instead, supply them via environment variables or a local override file.

**Option A — Environment variables (recommended for production)**

Create a `secrets.env` file outside the repository (e.g. `/etc/bos/secrets.env`) and set it as an `EnvironmentFile` in your systemd service. This file should never be committed.

```env
Google__ClientId=your-oauth-client-id
Google__ClientSecret=your-oauth-client-secret
Google__AllowedDomain=yourdomain.com
Google__ServiceAccountKeyPath=/etc/bos/google-sa.json
```

Place the service account JSON key file at the path specified above and restrict permissions:

```bash
chmod 600 /etc/bos/google-sa.json
chmod 600 /etc/bos/secrets.env
```

**Option B — Local override file (development)**

Create `backend/appsettings.Local.json` (already gitignored):

```json
{
  "Google": {
    "ClientId": "your-oauth-client-id",
    "ClientSecret": "your-oauth-client-secret",
    "AllowedDomain": "yourdomain.com",
    "ServiceAccountKeyPath": "/path/to/google-sa.json"
  }
}
```

### 4. Apply database migrations

```bash
cd backend
dotnet ef database update
```

The database will be created at the path specified in `Database:Path` (`appsettings.json`). For local development you can override this to a local path.

### 5. Run the application

**Development (two terminals):**

```bash
# Terminal 1 — backend
cd backend
dotnet run

# Terminal 2 — frontend
cd frontend
npm run dev
```

**Production build:**

```bash
cd frontend
npm run build
# Serve the dist/ output via a reverse proxy (e.g. Nginx) pointing to the backend on port 5000
```

---

## Configuration Reference

All configuration keys follow ASP.NET Core conventions. Environment variables use double underscore (`__`) as the hierarchy separator (e.g. `Google__ClientId` maps to `Google:ClientId`).

| Key | Description | Required |
|---|---|---|
| `Google:ClientId` | OAuth 2.0 Client ID | Yes |
| `Google:ClientSecret` | OAuth 2.0 Client Secret | Yes |
| `Google:AllowedDomain` | Restricts sign-in to this Workspace domain (leave empty to allow any Google account) | No |
| `Google:ServiceAccountKeyPath` | Absolute path to the service account JSON key file | For alias detection |
| `Database:Path` | Absolute path to the SQLite database file | Yes |

---

## Adobe PDF Services

PDF price sheet uploads require an [Adobe PDF Services](https://developer.adobe.com/document-services/) account. Credentials are configured per-deployment through **Settings → Adobe PDF Services** within the application itself — no configuration file entry is needed. If no credentials are configured, PDF upload is disabled and only XLSX/CSV uploads are available.

---

## License

MIT
