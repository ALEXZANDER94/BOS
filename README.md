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
- **Projects** — associate projects with clients and contacts, track status; click any project to open its detail page
  - **CSV import** — bulk-create projects from a CSV file (`ProjectName`, `ClientName`, `Description`); clients are matched by name, duplicates are skipped with a clear report
- **Activity Logs** — record notes and activity against client records

### Project Details
- Dedicated detail page per project with three tabs: **Overview**, **Buildings & Lots**, and **Purchase Orders**
- **Overview** — full description, summary stats (buildings, lots, PO count, total PO amount), and assigned contacts
- **Buildings & Lots** — hierarchical tree of buildings and lots within a project; add, rename, and delete inline without leaving the page
  - Each lot can have a street address attached (add, edit, or remove inline)
  - Deleting a lot that has purchase orders is blocked with a clear error message
  - Building expand/collapse state is persisted to localStorage per project; **Expand All** / **Collapse All** buttons appear when there is more than one building
- **Purchase Orders** — log purchase orders against a specific lot within the project
  - **QB Status** — read-only status synced from QuickBooks Online: `Unpaid` (invoice exists, balance > 0), `Paid` (balance = 0), or `Not Found` (no matching invoice)
  - QuickBooks matching is performed by searching Invoice line item descriptions for the BOS order number; the matched Invoice Number is pulled into BOS and displayed alongside the order
  - **Internal Status** — user-defined statuses (with custom colours) assignable per PO inline; managed globally via the **Statuses** dialog
  - **Sync** button per row, or **Sync All** to refresh every PO on the project at once; buttons are disabled with a tooltip when QuickBooks is not connected
  - **Multi-select QB status filter** — toggle one or more status pills to filter the table; click **Clear** to reset
  - **CSV import** — bulk-import purchase orders from a CSV file (`OrderNumber`, `BuildingName`, `LotName`, `Amount`, `Status`); buildings and lots that do not yet exist are created automatically
  - **Export to Excel** — exports the current filtered results (`Order #`, `Building`, `Lot`, `Amount`) as an `.xlsx` file

### Email (Gmail Integration)
- Sign in with Google to connect your Gmail account (read-only access)
- View and read emails directly within BOS
- **Filter by client** — automatically surfaces emails matching a client's domain and contacts
- **Filter by group/alias** — detect Google Workspace groups and user aliases via the Admin SDK and filter the inbox by them
- **Toggleable aliases** — hide aliases you don't use from the filter sidebar; preference is persisted per user
- **Filter by category** — assign user-defined categories to emails and view them as a faceted list
- **Status filter** — when viewing a category, a dropdown above the email list filters by that category's workflow statuses
- **Search** — search across subject, sender, and body content via Gmail's native search
- **Email categories** — user-defined top-level classifications (e.g. Invoice, Scheduling, Proposal) with colored badges
- **Category statuses** — user-defined workflow statuses scoped to each category (e.g. On-Hold, Processing, Completed)
- Assign and reassign categories and statuses to emails in real time
- **Attachments** — attachments are listed as clickable chips in the email detail header; images and PDFs open inline in a new tab, all other file types download directly. No additional OAuth scopes are required beyond `gmail.readonly`
- **Collapsible To: field** — long recipient lists are truncated to the first address with a "+N more" toggle
- **Add to BOS** — add a sender or recipient directly as a new Client or Contact from the email detail view; domain matching automatically suggests the correct client to link to
- **Pagination** — configurable page size (25 / 50 / 100) with a "Load more" button; preference is persisted per user
- Drafts are automatically excluded from all email views

### Email Notes
- Leave persistent notes on any email, visible to all users on the workspace
- Notes panel sits in a sidebar to the right of the email detail view
- Only the note author can edit or delete their own notes
- **@mention** — type `@` while writing a note to bring up a searchable dropdown of Google Workspace users; selecting a user inserts their address and tags them in the note
  - When viewing an alias-filtered inbox, only members of that alias group are taggable
- Note count indicators appear on email rows in the list

### Notifications
- Users receive an in-app notification whenever they are @mentioned in a note
- **Bell icon** in the top bar shows the number of unread notifications at a glance
- Clicking the bell opens a notification panel listing recent alerts with timestamps
- Clicking a notification navigates directly to the relevant email and marks it as read
- "Mark all read" action available in the notification panel
- **Real-time push** — notifications are delivered instantly via SignalR WebSockets; a toast appears in the bottom-right corner when a new notification arrives, even when the user is on a different page
- Notifications older than 30 days are automatically purged to prevent database growth

### Navigation
- **Collapsible sidebar** — the main navigation sidebar can be collapsed to an icon-only strip to reclaim screen space; expanded or collapsed state is remembered across sessions

### User Preferences
- Per-user preferences (alias visibility, email page size) are stored on the server and roam across devices and browsers

### Settings
- Configure Adobe PDF Services credentials
- Connect or disconnect QuickBooks Online via OAuth
- Manage application-wide settings

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 8, C#, Entity Framework Core, SQLite |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix UI |
| Auth | Google OAuth 2.0 (cookie-based session) |
| Email | Gmail API (read-only), Google Admin SDK Directory API |
| Real-time | ASP.NET Core SignalR (WebSockets) |
| PDF | Adobe PDF Services SDK |
| Accounting | QuickBooks Online API (OAuth 2.0, PO status sync) |
| Excel export | SheetJS (xlsx) |

---

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- A **Google Cloud project** with a configured OAuth consent screen
- A **Google Workspace** account (required for group/alias detection, @mention tagging, and real-time notifications via the Admin SDK)
- An **Adobe PDF Services** account (required for PDF price sheet uploads; optional otherwise)
- An **Intuit Developer account** (required for QuickBooks PO sync; optional otherwise)

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

### 4. Service Account (Admin SDK Features)

The service account is used for alias/group detection, the @mention user list, and notification routing. All three features share the same key file.

1. Go to **IAM & Admin → Service Accounts → Create Service Account**
2. Name it (e.g. `BOS Directory Reader`); do not assign any project-level roles
3. Open the created service account, go to **Keys → Add Key → Create new key → JSON**, and download the file
4. Note the **Unique ID** displayed on the service account details page — this is the OAuth Client ID used in the next step

---

## Google Workspace Admin Console Setup

> Requires a Super Admin account. Go to [admin.google.com](https://admin.google.com).

### Domain-wide Delegation

1. Go to **Security → Access and data control → API controls → Manage Domain Wide Delegation**
2. Click **Add new**
3. Enter the service account **Unique ID** (from step 4 above) as the Client ID
4. Add **all** of the following scopes as a single comma-separated list:
   ```
   https://www.googleapis.com/auth/admin.directory.group.readonly,
   https://www.googleapis.com/auth/admin.directory.user.alias.readonly,
   https://www.googleapis.com/auth/admin.directory.user.readonly,
   https://www.googleapis.com/auth/admin.directory.group.member.readonly
   ```
5. Click **Authorize**

| Scope | Used for |
|---|---|
| `admin.directory.group.readonly` | Listing alias groups the signed-in user belongs to (filter sidebar) |
| `admin.directory.user.alias.readonly` | Listing per-user email aliases (filter sidebar) |
| `admin.directory.user.readonly` | Listing all domain users for the @mention dropdown |
| `admin.directory.group.member.readonly` | Listing members of an alias group for context-aware @mention |

> **Note:** `Google:ServiceAccountAdminEmail` must be set to an account with **Super Admin** privileges. The Directory API requires admin-level impersonation even for read-only calls.

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
Google__ServiceAccountAdminEmail=admin@yourdomain.com
QuickBooks__ClientId=your-intuit-client-id
QuickBooks__ClientSecret=your-intuit-client-secret
QuickBooks__RedirectUri=https://yourdomain.com/api/quickbooks/callback
QuickBooks__EncryptionKey=your-base64-32-byte-key
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
    "ServiceAccountKeyPath": "/path/to/google-sa.json",
    "ServiceAccountAdminEmail": "admin@yourdomain.com"
  },
  "QuickBooks": {
    "ClientId": "your-intuit-client-id",
    "ClientSecret": "your-intuit-client-secret",
    "RedirectUri": "http://localhost:5000/api/quickbooks/callback"
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
# The built assets are written to backend/wwwroot and served by ASP.NET Core directly.
# Point your reverse proxy (e.g. Nginx) at the backend on port 5000.
```

---

## Nginx Configuration (Production)

If you are serving BOS behind Nginx, the `/hubs/` path requires WebSocket upgrade headers for SignalR to function. Without these, real-time notifications will not be delivered (though the rest of the application is unaffected).

```nginx
# Standard API and SPA traffic
location / {
    proxy_pass         http://localhost:5000;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}

# SignalR WebSocket hub — requires upgrade headers
location /hubs/ {
    proxy_pass         http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

---

## Configuration Reference

All configuration keys follow ASP.NET Core conventions. Environment variables use double underscore (`__`) as the hierarchy separator (e.g. `Google__ClientId` maps to `Google:ClientId`).

| Key | Description | Required |
|---|---|---|
| `Google:ClientId` | OAuth 2.0 Client ID | Yes |
| `Google:ClientSecret` | OAuth 2.0 Client Secret | Yes |
| `Google:AllowedDomain` | Restricts sign-in to this Workspace domain (leave empty to allow any Google account). Also used to enumerate domain users for @mention. | Recommended |
| `Google:ServiceAccountKeyPath` | Absolute path to the service account JSON key file | For Admin SDK features |
| `Google:ServiceAccountAdminEmail` | A Super Admin account email used to impersonate for Directory API calls | For Admin SDK features |
| `Database:Path` | Absolute path to the SQLite database file | Yes |
| `QuickBooks:ClientId` | Intuit app Client ID | For QB sync |
| `QuickBooks:ClientSecret` | Intuit app Client Secret | For QB sync |
| `QuickBooks:RedirectUri` | OAuth callback URI registered in the Intuit Developer Console | For QB sync |
| `QuickBooks:EncryptionKey` | Base64-encoded 32-byte AES-256 key used to encrypt tokens at rest. Generate with `openssl rand -base64 32`. | For QB sync |

---

## Adobe PDF Services

PDF price sheet uploads require an [Adobe PDF Services](https://developer.adobe.com/document-services/) account. Credentials are configured per-deployment through **Settings → Adobe PDF Services** within the application itself — no configuration file entry is needed. If no credentials are configured, PDF upload is disabled and only XLSX/CSV uploads are available.

---

## QuickBooks Online Integration

Purchase order status sync requires a free [Intuit Developer](https://developer.intuit.com/) account. The OAuth credentials identify the BOS application to Intuit; the end user's QuickBooks company is connected separately via the consent screen.

### 1. Create an Intuit Developer app

1. Sign in at [developer.intuit.com](https://developer.intuit.com)
2. Go to **Dashboard → Create an app → QuickBooks Online and Payments**
3. Under **Keys & credentials**, copy the **Client ID** and **Client Secret** from the **Production** tab
4. Under **Redirect URIs**, add your callback URL:
   - Development: `http://localhost:5000/api/quickbooks/callback`
   - Production: `https://yourdomain.com/api/quickbooks/callback`

> **Note:** Intuit requires an End User License Agreement URL and Privacy Policy URL when creating the app. For a private internal deployment, links to your client's existing website policies are sufficient. The app does not need to pass Intuit's review process to function — development mode supports up to 25 connected companies.

### 2. Configure BOS

Add the credentials via environment variables or `appsettings.Local.json`:

```env
QuickBooks__ClientId=your-intuit-client-id
QuickBooks__ClientSecret=your-intuit-client-secret
QuickBooks__RedirectUri=https://yourdomain.com/api/quickbooks/callback
QuickBooks__EncryptionKey=your-base64-encoded-32-byte-key
```

Generate the encryption key once on the server and keep it safe — if it is lost, you will need to disconnect and reconnect QuickBooks:

```bash
openssl rand -base64 32
```

The access token, refresh token, and realm ID are encrypted at rest using AES-256-GCM before being written to the database. The encryption key is never stored in the database or source code.

### 3. Connect the QuickBooks company

1. Start BOS and sign in
2. Go to **Settings → QuickBooks**
3. Click **Connect QuickBooks** — you will be redirected to Intuit's consent page
4. Sign in with the QuickBooks Online account that owns the company data and click **Authorize**
5. BOS stores the access token; the Settings page will show **Connected**

Once connected, purchase order statuses can be synced from any Project Detail page via the **Sync** or **Sync All** buttons on the Purchase Orders tab.

### Viewing QuickBooks logs

All QuickBooks API activity is logged at `Debug` level and above under the category `BOS.Backend.Services.QuickBooksService`. On a production server running under systemd:

```bash
# All QuickBooks log entries
journalctl -u bos --no-pager | grep QuickBooksService

# Live tail — useful when debugging a sync in real time
journalctl -u bos -f | grep QuickBooksService

# Errors and above only
journalctl -u bos -p err
```

Sensitive values (access tokens, refresh tokens, client secret) are never written to the log. Logged information includes: authorization URL generation, token exchange and refresh outcomes (with HTTP status codes and response bodies on failure), PO query results, and disconnect events.

---

## License

MIT
