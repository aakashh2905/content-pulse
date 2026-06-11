# ASPI Content Pulse Production Action Plan

Date: 6 May 2026

Context: ASPI Content Pulse is an internal agency operating tool. The agency uses it to research live social content signals, plan client page growth, and generate draft scripts/hooks for human review.

## Executive Recommendation

Move from the current local prototype to an internal production system in three phases:

1. Stabilize the current Node prototype for controlled internal use.
2. Move storage and scheduled jobs to durable cloud services.
3. Add agency workflow controls: client workspace, approvals, reporting, and usage governance.

The product should not be positioned as a public SaaS yet. It should first become a reliable internal agency system for client social media growth.

## Phase 0: Immediate Hardening

Status: started in code.

Action points:

- Add request body limits to prevent oversized payloads.
- Add run concurrency limits to avoid accidental cost spikes.
- Add external API timeouts for Apify and OpenAI.
- Return proper `400`, `413`, and `429` API errors instead of generic server failures.
- Add runtime metadata to `/api/health`, including uptime and active run count.
- Keep secrets out of docs and logs.
- Keep local file storage as fallback while SharePoint is not configured.

Acceptance criteria:

- Bad JSON returns `400`.
- Oversized requests return `413`.
- Multiple simultaneous runs are throttled with `429`.
- Apify/OpenAI timeouts are visible as controlled run warnings/errors.
- `/api/health` shows runtime health without exposing secrets.

## Phase 1: Internal Production MVP

Goal: reliable daily usage by the agency team.

Recommended architecture:

- Frontend: current local web UI evolved into a deployed internal web app.
- Backend: Node.js API deployed as an internal service.
- Storage: SharePoint Lists as system of record.
- Scheduler: cloud scheduler or Azure Function Timer Trigger, not a local interval.
- Secrets: Azure Key Vault or managed app settings.
- Auth: Microsoft Entra ID login restricted to internal users.

Required work:

- Configure SharePoint lists for runs, posts, campaigns, and approvals.
- Add Microsoft login before allowing access to the dashboard.
- Move scheduled campaign execution off the local server.
- Add copy/export buttons for script, hooks, cards, and client report.
- Add filters for bucket, region confidence, views, engagement, date, and author.
- Add run detail view from history.
- Add approval states: draft, reviewed, approved, rejected, published.
- Add client / brand as a required field for saved campaigns.

Acceptance criteria:

- Team can access the tool from a shared internal URL.
- A daily campaign runs even if the developer laptop is off.
- All runs and posts are visible in SharePoint.
- Managers can review why a recommendation was made.
- The team can export a client-ready report without opening raw JSON.

## Phase 2: Agency Workflow Optimization

Goal: make the tool useful for day-to-day client operations, not just research.

Action points:

- Add client workspaces.
- Add brand voice profiles per client.
- Add competitor sets per client.
- Add region defaults per client.
- Add reusable campaign templates.
- Track accepted scripts and rejected scripts.
- Track which recommendations became published posts.
- Add a weekly client insight digest.
- Add a dashboard for time saved, ideas generated, scripts accepted, and campaign coverage.

Acceptance criteria:

- Each client has saved keywords, competitor handles, region, language, and voice samples.
- Strategists can run a weekly review for one client in under 10 minutes.
- Account managers can see what was researched for each client.
- Leadership can see internal usage and content output volume.

## Phase 3: Scale And Governance

Goal: make the system safe, observable, and cost-controlled.

Action points:

- Add per-user and per-client run limits.
- Add cost tracking for OpenAI and Apify calls.
- Add retry policy with exponential backoff for external APIs.
- Add structured logs for every run stage.
- Add alerting for repeated API failures.
- Add backup/export policy for SharePoint data.
- Add admin panel for API status, scheduler status, failed runs, and usage limits.
- Add audit trail for approvals and published outputs.

Acceptance criteria:

- Admin can identify failed runs without reading server logs.
- Leadership can see monthly usage and estimated API cost.
- A failed Apify/OpenAI call does not break the whole system silently.
- The tool has a clear policy for data retention and client separation.

## Key Product Decisions Needed

The team should decide these before full production deployment:

- Hosting: Azure App Service, Azure Functions, or another internal hosting option.
- Auth: Microsoft-only login or simple internal VPN/access control.
- Storage: SharePoint Lists only, or SharePoint plus SQL for analytics.
- Scheduling: Azure Function Timer Trigger or Power Automate.
- Report format: web report, PDF, PowerPoint, or SharePoint page.
- Approval workflow owner: strategist, account manager, or team lead.
- Data retention: how long to keep raw scraped payloads.

## Production Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Local scheduler stops when laptop/server stops | Daily campaigns are missed | Move scheduler to cloud |
| SharePoint not configured | Team cannot centralize results | Complete Microsoft Graph setup |
| API costs grow silently | Budget risk | Add run limits and usage dashboard |
| Apify actor changes payload shape | Cards or metrics break | Keep raw payload, normalize defensively, add tests |
| Weak keywords return poor results | Team loses trust | Keep recovery suggestions and add competitor sets |
| AI output is used without review | Brand risk | Add approval workflow |
| Regional trend signals are inferred | Misinterpretation risk | Show regional confidence and caveat in UI |

## Implementation Priority

Must do next:

- Complete SharePoint configuration.
- Add Microsoft login.
- Replace local scheduler with durable scheduler.
- Add export/copy/report actions.
- Add filters and run detail page.
- Add approval states.

Should do after:

- Client workspaces.
- Brand voice profiles.
- Usage/cost dashboard.
- Structured logs and admin page.
- Weekly client digest.

Could do later:

- PowerPoint report generation.
- Cross-platform sources beyond Instagram.
- Direct publishing integration.
- Advanced competitor benchmarking.

## Final Recommendation

Do not scale this as a public SaaS yet. Scale it as an internal agency operations platform first. The correct production target is:

Client workspace -> live trend research -> regional evidence -> content buckets -> script/hooks -> human approval -> client-ready report -> stored history.
