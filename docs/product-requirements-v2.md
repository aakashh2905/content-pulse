# ASPI Content Pulse Product Requirements V2

Date: 5 May 2026

Owner role: Business analyst plus solution architect

Status: Corrected requirements for real user usage

## 1. Executive Summary

ASPI Content Pulse is an internal content intelligence tool for a marketing agency team. The agency helps client brands scale their social media pages, so the product should help the internal team move from a client, keyword, region, and competitor set to useful content decisions without needing to understand scraping, prompt engineering, JSON, or technical settings.

The current prototype proves the concept: it can search Instagram through Apify, generate analysis and writing through OpenAI, show cards in a local dashboard, and save runs locally. The real user-end problem is that the product still behaves like a technical prototype in several places.

The corrected requirement is:

ASPI Content Pulse must become a guided internal agency workflow where the user always knows which client the run is for, what to enter, what happened, why a result was produced, what to do when a keyword fails, and how to export or reuse the final content for client page growth.

## 2. Product Goal

Create a reliable content intelligence workflow for an agency team that needs daily Instagram trend research, client-specific content angles, scripts, hooks, and regional evidence for brand page growth.

The product should reduce manual research time, make content decisions more evidence-based, and help the agency produce stronger client-ready social media recommendations.

## 2.1 Operating Context

This is not a public multi-tenant SaaS in the current phase. It is an internal agency operating tool.

Core business context:

- The agency helps brands scale their social media pages.
- Internal users need faster trend research, content planning, and script ideation.
- Every run should be tied to a client or brand whenever possible.
- The output should support account managers, strategists, and creators during client planning.
- Human review remains mandatory before anything is sent to a client or published.

## 3. Target Users

### Social Media Strategist

Primary daily user.

Needs:

- Select the client or brand account.
- Search a keyword or campaign topic.
- See relevant Instagram posts quickly.
- Understand what type of content is working.
- Generate usable scripts and hooks.
- Export or copy outputs.

Pain points:

- Does not want technical fields.
- Does not understand why some keywords fail.
- Needs clear next steps when results are weak.

### Account Manager / Social Media Manager

Operational user.

Needs:

- Connect research to a specific client page.
- Run repeated campaigns.
- Compare topic buckets.
- Save useful runs.
- Use filters to shortlist posts.
- Keep links to original reels/posts.

Pain points:

- Needs speed and clarity.
- Needs confidence that results are real.
- Needs ability to retry without guessing.

### Agency Lead / Marketing Manager

Decision maker.

Needs:

- Review client-specific recommendations.
- See why a topic was recommended.
- Review run history.
- Understand campaign performance.
- Approve or reject scripts.
- Share reports with team members.

Pain points:

- Does not want raw JSON.
- Needs business language, not technical logs.
- Needs audit trail and storage.

### Admin / Technical Owner

System owner.

Needs:

- Configure API keys securely.
- Manage SharePoint integration.
- Monitor failures and costs.
- Keep schedules reliable.
- Control platform settings.

Pain points:

- Needs safe secret handling.
- Needs observability.
- Needs predictable background jobs.

## 4. Current Real User Problems

| Problem ID | User Problem | Root Cause | Corrected Requirement |
| --- | --- | --- | --- |
| P1 | Some keywords return no useful reels | Broad or weak keywords do not map cleanly to Instagram discovery | The system must normalize, expand, retry, and suggest better keyword seeds |
| P2 | User cannot tell whether a run failed or partially succeeded | Runtime notices are mixed with real errors | Status must separate success, warning, action needed, and failed states |
| P3 | Generated content can drift into Hindi or Hinglish when English is expected | Language is inferred implicitly | Output language must be explicit and default to English |
| P4 | User does not know which skill to run | The stage concept is technical | UI must explain `Run all skills` as the recommended default |
| P5 | SharePoint warnings look like blockers | Storage fallback is not clearly explained | App must say local storage is active and SharePoint is optional until configured |
| P6 | Results are hard to shortlist | Cards exist, but filtering/sorting is missing | Add filters for bucket, views, engagement, date, author, and source mode |
| P7 | Final outputs are not easy to use | No copy/export buttons in the UI | Add copy script, copy hooks, download report, and export JSON |
| P8 | Campaign automation is not production reliable | Scheduler depends on local server process | Production scheduling must use a durable cloud scheduler or queue |
| P9 | Managers cannot evaluate value quickly | No business metrics dashboard | Add time saved, ideas generated, scripts accepted, and campaign run metrics |
| P10 | No user approval workflow | AI output is generated but not governed | Add status states: draft, reviewed, approved, rejected, published |
| P11 | API cost can grow silently | No usage limits shown to user/admin | Add per-run and per-day limits plus cost visibility |
| P12 | Technical setup is exposed in wrong places | Prototype fields and runtime details leak into UX | Move developer/admin settings into an admin page |
| P13 | Research is not clearly tied to a client brand | Prototype treated runs as generic keyword searches | Add client / brand context to the run, campaign, report, and history |
| P14 | Agency team needs practical page-growth decisions, not only inspiration | Outputs can read like generic trend analysis | Recommendations must explain what to copy, what to avoid, and how the angle helps the client page grow |

## 5. Corrected Product Scope

### In Scope For MVP

- Instagram keyword and competitor research.
- Client / brand context on manual and scheduled runs.
- Apify-backed public post discovery.
- OpenAI-backed topic validation, script writing, and hook generation.
- Explicit output language control.
- Keyword recovery suggestions.
- Clickable post cards with thumbnails and source links.
- Local run storage.
- Saved campaign configuration.
- Basic run history.
- SharePoint-ready storage adapter.
- Manager-friendly output reports.

### In Scope For Production V1

- Microsoft login.
- SharePoint as system of record.
- Cloud hosting.
- Reliable scheduled runs.
- Copy/export/report actions.
- Filters and sorting.
- Usage limits and error logs.
- Approval workflow.
- Admin configuration page.

### Out Of Scope For Now

- Direct publishing to Instagram.
- Paid ad management.
- Full multi-tenant billing SaaS.
- Guaranteed scraping for private accounts.
- Replacing human content approval.
- Generating final brand-approved content without review.

## 6. Corrected User Journey

### Journey A: First-Time Manual Run

1. User opens ASPI Content Pulse.
2. User sees the app status: OpenAI ready, Apify ready, storage mode.
3. User enters the client or brand name.
4. User enters a keyword.
5. User optionally adds competitor handles.
6. User chooses industry, region, goal, and output language.
7. App recommends `Run all skills`.
8. User clicks run.
9. App shows loading state with current stage.
10. App displays result cards.
11. App displays topic recommendation.
12. App displays script and hooks.
13. User copies or exports the output for internal review.
14. Run is saved in history.

Acceptance criteria:

- User can run the workflow without reading documentation.
- If results are found, cards must include thumbnail, caption summary, author, metrics, and source link.
- If results are not found, user must receive specific retry suggestions.
- Script and hooks must follow selected output language.
- Run output should clearly show the client or brand when supplied.

### Journey B: Weak Keyword Recovery

1. User enters a broad or weak keyword.
2. App normalizes spelling and expands related hashtag seeds.
3. App tries primary and broadened search strategies.
4. If no results are found, app shows stronger seed suggestions.
5. User can click or copy a suggested seed.
6. User reruns the search.

Acceptance criteria:

- Empty results must not be a dead end.
- User must receive at least three suggested keyword alternatives when possible.
- App must recommend adding competitor handles when keyword-only search is weak.

### Journey C: Campaign Setup

1. User enters campaign name.
2. User enters keyword set.
3. User selects run schedule.
4. User saves campaign.
5. Campaign appears in saved campaigns.
6. User can run now, pause, activate, or delete.

Acceptance criteria:

- Campaign must store keyword, competitors, industry, goal, output language, lookback, max posts, and run target.
- Saved campaign should be runnable manually.
- Production scheduler must survive app restarts.

### Journey D: Manager Review

1. Manager opens run history.
2. Manager selects a previous run.
3. Manager sees summary, recommended topic, source posts, generated script, and hooks.
4. Manager can approve, reject, or request edits.
5. Team can export report.

Acceptance criteria:

- Manager should not need raw JSON.
- Report must include source links behind recommendations.
- Approval state must be visible.

## 7. Functional Requirements

### FR0: Client / Brand Context

The system must allow the internal agency user to specify the client or brand account for each run.

Rules:

- Client / brand name is optional for quick tests but recommended for real internal usage.
- Saved campaigns should preserve client / brand name.
- Run history and reports should display client / brand name when available.
- AI recommendations should be framed as client-ready social media planning support.

Acceptance criteria:

- User can enter a client or brand before running the workflow.
- Campaigns preserve the client / brand field.
- Run summaries include `Client / brand`.
- Generated recommendations should avoid generic advice and stay useful for an agency social media team.

### FR1: Keyword Input And Search Expansion

The system must accept one or more keywords.

Rules:

- Trim whitespace.
- Split comma-separated or line-separated values.
- Correct known typo patterns.
- Generate hashtag-style variants.
- Generate related niche variants.
- Keep original keyword for audit.

Acceptance criteria:

- Keyword `AI Marketing` should generate variants such as `aimarketing`, `digitalmarketing`, `marketingautomation`, and `aitools`.
- Keyword typo `marketting` should be treated as `marketing`.
- User should see recovery suggestions if no live items are returned.

### FR2: Competitor Input

The system must accept optional Instagram handles.

Rules:

- Accept `@handle`.
- Accept full Instagram profile URLs.
- Strip invalid URL parts.
- Treat handles as public profile discovery targets.

Acceptance criteria:

- User can paste `@creator_one` or `https://instagram.com/creator_one`.
- System should not fail if one handle is invalid.

### FR3: Platform Scope

MVP platform is Instagram.

Rules:

- YouTube and X are not part of the current active user flow.
- Do not expose inactive platforms in the primary UI.
- Architecture can keep platform extensibility internally.

Acceptance criteria:

- Main workflow should clearly communicate Instagram trend discovery.

### FR4: Run Target

The system must support partial and full runs.

Run targets:

- Content scraper only.
- Validator output.
- Voice writer output.
- Hook generator output.
- Run all skills.

Rules:

- `Run all skills` is the default recommended mode.
- Partial runs must clearly explain which later stages were skipped.
- Partial runs must not break persistence.

Acceptance criteria:

- Button label must match selected run target.
- Scraper-only run should not show script as failed; it should say writer stage was not run.

### FR5: Output Language

The system must provide explicit output-language control.

Rules:

- Default language is English.
- Auto mode can infer from voice samples.
- Explicit selected language overrides voice-sample language.
- Script and hooks must use the same selected language.

Acceptance criteria:

- English selected means script and hooks are in English.
- Hinglish selected means script and hooks are in Hinglish.
- Hindi selected means script and hooks are in Hindi.
- Voice samples should influence tone but not override explicit language.

### FR6: Content Cards

The system must display discovered posts as cards.

Each card should show:

- Thumbnail.
- Platform.
- Format.
- Author.
- Caption or hook preview.
- Views.
- Engagement rate.
- Date.
- Topic or bucket.
- Source link.

Acceptance criteria:

- Clicking thumbnail or title opens original Instagram post in a new tab.
- Missing thumbnail must show a graceful placeholder.
- Cards should not show raw technical payloads.

### FR7: Filtering And Sorting

The system must allow users to shortlist results.

Required filters:

- Content bucket.
- Minimum views.
- Minimum engagement rate.
- Date range.
- Author handle.
- Viral only.

Required sorting:

- Highest views.
- Highest engagement.
- Newest.
- Best score.

Acceptance criteria:

- Filters update visible cards without rerunning the scrape.
- Reset filters action is available.

### FR8: Topic Validation

The system must rank topics from scraped content.

Rules:

- Use strict scoring by default.
- Use relaxed scoring for lower-volume niches.
- Use fallback top-post scoring if nothing passes thresholds.
- Show threshold mode in technical details or report.

Acceptance criteria:

- Low-volume keywords still produce a useful report when posts exist.
- Empty reports should only happen when no usable posts exist.

### FR9: Script Generation

The system must generate a camera-ready script after validation.

Script structure:

- Beat 1.
- Beat 2.
- Beat 3.
- CTA.

Rules:

- Do not include hooks in script body.
- Follow selected language.
- Use selected industry and goal.
- Mention assumptions if no voice sample is provided.

Acceptance criteria:

- User can copy script with one click.
- Script is saved in run output.

### FR10: Hook Generation

The system must generate exactly five hooks.

Hook types:

- Aspirational outcome.
- Pain point.
- Hidden truth.
- Time or money claim.
- Curiosity gap.

Rules:

- Hooks must be under four seconds when spoken.
- Hooks must follow selected output language.
- One hook must be recommended with reason.

Acceptance criteria:

- User can copy each hook.
- User can copy all hooks.
- Hook recommendation is visible.

### FR11: Export And Sharing

The system must support export actions.

Required exports:

- Copy script.
- Copy hooks.
- Download markdown report.
- Download JSON output.
- Copy source links.

Acceptance criteria:

- Non-technical users can get useful output without opening local folders.

### FR12: Run History

The system must store and display recent runs.

Rules:

- Show keyword, date, run status, scrape mode, number of posts, and recommended topic.
- Allow opening a previous run in the UI.

Acceptance criteria:

- User can compare current run with previous runs.
- User can reuse previous inputs.

### FR13: Campaigns

The system must support saved campaign configurations.

Rules:

- Campaign stores all run settings.
- Campaign can be active or paused.
- Campaign can be run manually.
- Production campaign runs must be durable.

Acceptance criteria:

- Campaign should not lose output-language setting.
- Campaign should track last status and last run.

### FR14: Storage

The system must support local storage for prototype and SharePoint for production.

Rules:

- Local storage is fallback.
- SharePoint is production target.
- User-facing message must not treat local fallback as run failure.

Acceptance criteria:

- Health endpoint shows current storage mode.
- If SharePoint is missing credentials, run still completes locally.

### FR15: Admin Settings

The system must provide admin-only settings in production.

Admin settings:

- API status.
- Actor IDs.
- Cost limits.
- Max posts.
- Default language.
- SharePoint status.
- Scheduler status.

Acceptance criteria:

- Normal users do not see implementation details unless needed.

## 8. Non-Functional Requirements

### Reliability

- A manual run should complete or return a clear recovery state.
- Platform-specific failures should not crash the entire run.
- Scheduled runs must be durable in production.

### Performance

- UI should show progress while running.
- Normal run should target completion within 60-120 seconds depending on Apify/OpenAI response time.
- Card filtering must be instant after results are loaded.

### Security

- API keys must not be displayed in UI.
- Secrets must not be committed to source control.
- Production secrets should be stored in a secure vault.
- SharePoint access should use Microsoft Entra app registration.

### Usability

- User should understand the next action at every state.
- Empty results must provide recovery steps.
- Primary UI should use business terms, not developer terms.

### Observability

- Store run status.
- Store errors separately from warnings.
- Track API provider failures.
- Track cost-sensitive usage metrics.

### Compliance And Governance

- Only collect public content.
- Keep source links for traceability.
- AI-generated scripts should require human review before publishing.

## 9. Corrected Status Model

Run status must be explicit.

| Status | Meaning | User Message |
| --- | --- | --- |
| `idle` | No run started | Enter a keyword and run |
| `running` | Pipeline active | Show current stage |
| `completed` | Run completed with outputs | Show results |
| `completed_with_warnings` | Run completed but needs user attention | Show warning and next step |
| `no_results` | No usable posts found | Show keyword suggestions |
| `partial` | Only selected stages ran | Explain skipped stages |
| `failed` | Pipeline could not complete | Show reason and retry action |

## 10. Architecture Requirements

### Current Prototype Architecture

```text
Browser UI
  -> Local Node server
  -> Apify Instagram actor
  -> OpenAI
  -> Local data/runs files
  -> Optional SharePoint adapter
```

### Target Production Architecture

```text
Browser UI or SPFx web part
  -> Authenticated API
  -> Job queue
  -> Worker for Apify + OpenAI pipeline
  -> SharePoint lists
  -> Monitoring and logs
```

### Required Production Components

| Component | Requirement |
| --- | --- |
| Frontend | Web dashboard or SPFx web part |
| Backend API | Node service or Azure Function API |
| Background jobs | Queue-based worker or Azure WebJob |
| Storage | SharePoint lists as business database |
| Secrets | Environment variables now, secure vault in production |
| Auth | Microsoft Entra ID |
| Monitoring | Application logs and job status |

## 11. Data Requirements

### Run Record

Must store:

- Run ID.
- Created date.
- User or campaign.
- Keyword list.
- Competitor list.
- Industry.
- Goal.
- Output language.
- Run target.
- Status.
- Scrape mode.
- Number of posts.
- Recommended topic.
- Script.
- Hooks.
- Warnings.
- Errors.

### Post Record

Must store:

- Source platform.
- Source URL.
- Thumbnail URL.
- Author handle.
- Caption.
- Views.
- Likes.
- Comments.
- Shares.
- Engagement rate.
- Post date.
- Content format.
- Topic.
- Bucket.

### Campaign Record

Must store:

- Campaign ID.
- Name.
- Status.
- Schedule time.
- Time zone.
- Keywords.
- Competitors.
- Industry.
- Goal.
- Output language.
- Run target.
- Last run status.
- Last run date.
- Last error.

## 12. UX Requirements

### Main Workflow UI

Must keep these visible:

- Keyword.
- Competitors.
- Industry.
- Goal.
- Output language.
- Lookback.
- Max posts.
- Run target.
- Run button.

Must keep these away from normal users:

- API keys.
- Actor IDs.
- Raw JSON by default.
- SharePoint internal field names.
- Developer-only paths.

### Results UI

Must show:

- Search summary.
- Status and warnings.
- Card results.
- Topic recommendation.
- Script.
- Hooks.
- Copy/export actions.

### Empty State UI

Must show:

- Plain-language reason.
- Suggested hashtags.
- Recommendation to increase lookback.
- Recommendation to add public competitor handles.
- Rerun action.

## 13. Business Rules

- Default output language is English.
- Default platform is Instagram.
- Default run mode for non-technical users is `Run all skills`.
- Use 14-day lookback for better trend validation.
- Do not present SharePoint configuration as a run failure.
- Do not fabricate real post metrics.
- AI output is a draft until human approved.
- Source links must be preserved for every recommendation when available.

## 14. Prioritized Backlog

### Must Have

| ID | Requirement | Priority | Reason |
| --- | --- | --- | --- |
| M1 | Add copy buttons for script and hooks | P0 | Users need usable output immediately |
| M2 | Add download report button | P0 | Managers need shareable output |
| M3 | Add card filters and sorting | P0 | Users need to shortlist results |
| M4 | Add clear empty-result recovery UI | P0 | Weak keywords are a real usage issue |
| M5 | Make previous run clickable | P0 | Users need to revisit outputs |
| M6 | Store output language in campaigns and SharePoint | P0 | Prevent language drift in recurring campaigns |
| M7 | Separate warnings from errors in UI | P0 | Reduce confusion |

### Should Have

| ID | Requirement | Priority | Reason |
| --- | --- | --- | --- |
| S1 | Add approval status for scripts | P1 | Needed for team workflow |
| S2 | Add campaign analytics | P1 | Needed for manager view |
| S3 | Add admin settings page | P1 | Needed before production |
| S4 | Add keyword suggestion chips users can click | P1 | Improves failed keyword recovery |
| S5 | Add run progress by stage | P1 | Makes long runs feel reliable |
| S6 | Add cost and usage counters | P1 | Needed for API control |

### Could Have

| ID | Requirement | Priority | Reason |
| --- | --- | --- | --- |
| C1 | Add export to Excel | P2 | Useful for operations |
| C2 | Add saved keyword library | P2 | Speeds repeated research |
| C3 | Add multi-platform support back later | P2 | Useful after Instagram is stable |
| C4 | Add content calendar view | P2 | Useful for planning |

### Won't Have For MVP

| ID | Requirement | Reason |
| --- | --- |
| W1 | Auto-publish to Instagram | Requires governance and platform approvals |
| W2 | Full SaaS billing | Not needed for internal prototype |
| W3 | Private account scraping | Not reliable or appropriate for MVP |

## 15. Acceptance Test Pack

### Test 1: English Full Run

Input:

```text
Keyword: AI Marketing
Output language: English
Run target: Run all skills
Lookback: 14
Max posts: 5
```

Expected:

- Live or mixed Instagram results.
- Cards visible.
- Script in English.
- Five hooks in English.
- Run stored.

### Test 2: Hinglish Full Run

Input:

```text
Keyword: AI tools
Output language: Hinglish
Run target: Run all skills
```

Expected:

- Script in Hinglish.
- Hooks in Hinglish.
- No English-only output unless brand/tool names require it.

### Test 3: Weak Keyword

Input:

```text
Keyword: random low-signal phrase
Run target: Content scraper
```

Expected:

- If no results, show suggested hashtag seeds.
- User sees next action.
- Run does not look like a system crash.

### Test 4: Scraper-Only Run

Input:

```text
Run target: Content scraper only
```

Expected:

- Cards shown if posts found.
- Validation/script/hooks clearly marked as not run.
- No false error.

### Test 5: SharePoint Not Configured

Setup:

```text
Missing Graph credentials
```

Expected:

- Run completes locally.
- UI says SharePoint is pending.
- No false failure state.

## 16. Release Plan

### Release 0.2: Usability Stabilization

Target:

- Make existing prototype usable by non-technical users.

Scope:

- Copy/export actions.
- Filters and sorting.
- Clickable previous runs.
- Better empty states.
- Better status model.

### Release 0.3: Team Workflow

Target:

- Make outputs manageable by a team.

Scope:

- Approval statuses.
- Campaign analytics.
- Saved keyword library.
- Manager reports.

### Release 1.0: Internal Production

Target:

- Make the app reliable for internal use.

Scope:

- Microsoft login.
- SharePoint fully connected.
- Cloud hosting.
- Durable scheduler.
- Admin settings.
- Monitoring.

## 17. Open Questions

These need stakeholder answers before production:

- Who approves generated scripts before publishing?
- Should SharePoint be the only production database or only a reporting store?
- Which Microsoft tenant/site should hold production lists?
- What daily Apify/OpenAI budget is acceptable?
- How many users will run the app daily?
- Should exports be Markdown, PDF, Excel, or all three?
- Should the SPFx web part be the final front end or only a SharePoint display view?

## 18. Final BA Recommendation

The product should not add more AI features immediately. The next work should focus on operational trust:

- Clear run states.
- Reliable keyword recovery.
- Easy copy/export.
- Filtering and sorting.
- Saved run review.
- SharePoint persistence.
- Approval workflow.

These requirements convert ASPI Content Pulse from a technical prototype into a user-ready internal content intelligence product.
