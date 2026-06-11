# Content Pulse

Content Pulse is a local-first social intelligence and content workflow tool for marketing teams. It helps an agency research live content signals, group posts into content buckets, generate client-ready scripts and hooks, export reports, and collect LinkedIn lead/post data into Excel.

The current product name in the UI is **ASPI Content Pulse**.

## What It Does

- Scrapes recent social content signals using Apify actors.
- Uses OpenAI to classify topics, validate content angles, generate scripts, and write hooks.
- Shows Instagram trend cards with thumbnails, metrics, buckets, and source links.
- Supports regional market lenses and multilingual output controls.
- Exports completed runs as Excel, Markdown, or JSON.
- Includes a LinkedIn browser collector for visible LinkedIn search/feed posts with Excel export.
- Stores runs locally by default, with optional SharePoint storage through Microsoft Graph configuration.

## Core Use Cases

- Agency trend research for client social media growth.
- Content bucket discovery from live social posts.
- Short-form script and hook generation.
- LinkedIn post/lead capture from browser search results.
- Internal reporting through Excel/Markdown/JSON exports.

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js HTTP server using ES modules
- AI: OpenAI API
- Scraping: Apify actors
- Optional storage: SharePoint Lists via Microsoft Graph
- Local storage: JSON and Markdown files under `data/runs`

## Project Structure

```text
.
├── config/
│   ├── apify-actors.json
│   └── apify-actors.sample.json
├── docs/
│   ├── manager-project-explanation.md
│   ├── production-action-plan.md
│   ├── product-requirements-v2.md
│   └── sharepoint-storage.md
├── public/
│   ├── app.js
│   ├── index.html
│   ├── linkedin-collector.js
│   └── styles.css
├── scripts/
│   ├── create-sharepoint-lists.ps1
│   └── unify_leads.py
├── src/
│   ├── apify.js
│   ├── campaigns.js
│   ├── export.js
│   ├── industry.js
│   ├── openai.js
│   ├── pipeline.js
│   ├── scheduler.js
│   └── storage/
├── .env.example
├── package.json
└── server.js
```

## Setup

Install Node.js 22 or newer.

Create a local environment file:

```powershell
Copy-Item .env.example .env.local
```

Fill the required values in `.env.local`:

```text
OPENAI_API_KEY=
APIFY_TOKEN=
APIFY_INSTAGRAM_ACTOR_ID=
```

Start the app:

```powershell
npm run start
```

Open:

```text
http://localhost:3000
```

## Demo Mode

You can start without loading `.env.local`:

```powershell
npm run start:demo
```

Without API keys, OpenAI and Apify-dependent stages fall back to local/demo behavior where supported.

## Available Scripts

```powershell
npm run start
npm run start:demo
npm run check
```

`npm run check` validates the JavaScript files with `node --check`.

## Environment Variables

See `.env.example` for the complete list.

Important variables:

- `OPENAI_API_KEY`: OpenAI API key for content classification and generation.
- `OPENAI_MODEL`: model used for text/JSON generation.
- `APIFY_TOKEN`: Apify API token.
- `APIFY_INSTAGRAM_ACTOR_ID`: Apify actor ID for Instagram data.
- `STORAGE_PROVIDER`: `local`, `hybrid`, or `sharepoint`.
- `SHAREPOINT_*`: Microsoft Graph settings for optional SharePoint List persistence.

## API Endpoints

Core app:

- `GET /api/health`
- `POST /api/run`
- `GET /api/runs`
- `GET /api/runs/:runId`
- `GET /api/runs/:runId/export?format=excel`
- `GET /api/runs/:runId/export?format=markdown`
- `GET /api/runs/:runId/export?format=json`

Campaigns:

- `GET /api/campaigns`
- `POST /api/campaigns`
- `PATCH /api/campaigns/:campaignId`
- `DELETE /api/campaigns/:campaignId`
- `POST /api/campaigns/:campaignId/run`
- `POST /api/scheduler/run-due`

Browser/LinkedIn collection:

- `POST /api/linkedin/export`
- `POST /api/leads/export`
- `POST /api/browser-leads/export`
- `POST /api/browser-captures`
- `GET /api/browser-captures/:captureId/export?format=excel`

## LinkedIn Collector

The app includes a browser-side collector at:

```text
http://localhost:3000/linkedin-collector.js
```

Open the local app, copy the LinkedIn collector launcher, then run it on a LinkedIn search/results page. The collector can:

- Scan visible cards.
- Auto-scroll and collect more visible posts.
- Keep rows even when LinkedIn does not expose a real post URL.
- Download Excel through the local API.
- Fall back to browser-side Excel generation if the local API is unavailable.

## Exports

Completed content runs can be exported as:

- Excel-compatible `.xls`
- Markdown `.md`
- JSON `.json`

LinkedIn/browser captures can also be exported to Excel, Markdown, or JSON.

## Storage

By default, runs are written locally under:

```text
data/runs
```

Generated run data, browser captures, logs, and `.env` files are ignored by Git.

Optional SharePoint storage is documented in:

```text
docs/sharepoint-storage.md
```

## Security Notes

- Do not commit `.env.local` or any file containing real API keys.
- `.env`, `.env.*`, local run data, browser captures, campaign data, and logs are ignored.
- If a key was pasted into chat, browser history, or a shared screen, rotate it even if it was never committed.
- Public repos should use `.env.example` with empty placeholders only.

## Production Readiness Notes

This repository is a prototype-to-production foundation. Before using it as a hosted SaaS, add:

- Authentication and role-based access.
- Server-side job queue for long-running scrapes.
- Database-backed persistence.
- Rate limiting and audit logs.
- Secret manager integration.
- Formal Apify actor contracts per platform.
- Tests around pipeline normalization, exports, and API failure modes.

See:

```text
docs/production-action-plan.md
docs/product-requirements-v2.md
```

## License

No license has been assigned yet. Add a license before allowing external reuse.
