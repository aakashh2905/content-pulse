# ASPI Content Pulse

Manager explanation document

Date: 28 April 2026

## 1. Plain-English Summary

ASPI Content Pulse is a prototype web application for our internal marketing agency team. Our agency helps brands scale their social media pages, and this tool helps the team discover what type of Instagram content is currently working for a client topic, region, or competitor set, then convert that research into usable content ideas, scripts, and hooks.

Instead of manually searching Instagram, saving reels, checking captions, comparing engagement, and then writing content from scratch, this tool does the first draft of that workflow automatically.

The user enters the client or brand name, a keyword such as `AI Marketing`, a target region if needed, and the business goal. The app then pulls live Instagram content through Apify, analyzes the content with OpenAI, groups the content into useful buckets, recommends angles, and generates writing outputs such as scripts and hooks.

This is currently a working prototype. It runs locally on a computer, uses real Apify and OpenAI integrations, stores outputs locally, and is prepared for SharePoint storage once Microsoft Graph credentials are added.

## 2. Business Problem It Solves

Agency social media teams often need to create content quickly for multiple client brands, but the research process is slow and inconsistent.

Common problems:

- Teams guess what content to create instead of using live market signals.
- Research is scattered across Instagram links, screenshots, notes, and spreadsheets.
- Competitor and trend research takes too much manual time.
- Scripts and hooks are often written without knowing what is already performing.
- Good content ideas are not stored in a reusable system.
- Managers cannot easily see what research was used to justify a content idea.
- Internal teams can lose track of which research belongs to which client.

ASPI Content Pulse addresses this by turning live social content discovery into a repeatable workflow.

## 3. Who This Is For

Primary users:

- Social media managers
- Content strategists
- Agency teams
- Account managers
- Creative strategists
- Internal team members responsible for scaling client social pages

Manager-level users:

- Marketing managers who want visibility into why a content idea was chosen
- Team leads who want a repeatable process for content research
- Agency leaders who want a simple dashboard instead of raw tools

## 4. What The App Does

The app currently supports this workflow:

| Step | What Happens | Why It Matters |
| --- | --- | --- |
| 1 | User enters a keyword | Defines the content topic to research |
| 2 | App searches Instagram through Apify | Pulls live public content signals |
| 3 | App shows reels/posts as cards | Makes research easy to review visually |
| 4 | App groups results into content buckets | Shows patterns instead of isolated posts |
| 5 | App ranks topics | Helps choose what angle to create next |
| 6 | App generates a script | Converts research into usable content |
| 7 | App generates hooks | Helps improve the first 3 seconds of the video |
| 8 | App saves the run | Keeps a record for future review |
| 9 | App can save campaigns | Allows repeatable scheduled research |

## 5. Simple Analogy

Think of this app as a junior content researcher plus a junior scriptwriter.

The researcher checks what is trending, collects examples, and organizes them. The writer then uses that research to suggest topics, scripts, and hooks. A human still reviews and edits the final content before publishing.

## 6. Current Prototype Status

The prototype is working locally.

Confirmed working:

- Local web page opens at `http://localhost:3000`
- User can enter keywords
- Instagram data is pulled through Apify
- Reels/posts appear in card format
- Cards include thumbnails
- Cards link back to the original Instagram post
- User can choose which skill to run
- User can run all skills together
- OpenAI generates analysis, script, and hooks
- Runs are saved locally as files
- Campaigns can be saved
- Scheduler exists for daily campaign runs
- SharePoint storage logic exists

Currently pending:

- SharePoint is not connected yet because Microsoft Graph values are missing
- The app is still a prototype, not production-hosted
- Scheduled runs require the local server to stay running
- More testing is needed before using this as a company-wide product

## 7. Main Screen Explained

The current UI is designed like a SaaS dashboard.

### Top Bar

Shows the system name and runtime status.

Status badges show:

| Badge | Meaning |
| --- | --- |
| OpenAI ready | The app can use OpenAI for analysis and writing |
| Apify token ready | The app can call Apify for scraping |
| Actor mapping ready | Instagram scraping is configured |
| SharePoint storage needs config | SharePoint code exists, but Microsoft credentials are not yet added |

### Left Panel: Command Area

This is where the user controls the run.

Fields:

| Field | Meaning |
| --- | --- |
| Campaign name | Optional name for saving this research setup |
| Client / brand | The client account or brand page this research supports |
| Daily run | Time when a saved campaign should run |
| Status | Active or paused campaign |
| Industry | The market lens, such as agency, SaaS, creator, or D2C |
| Team | Type of team using the output |
| Goal | Client social media goal, such as leads, authority, community, or launch support |
| Skill to run | Controls whether the app runs only scraping or the full content pipeline |
| Keywords | Main search terms |
| Competitors | Optional Instagram handles |
| Lookback | How many days of recent content to consider |
| Max posts | Maximum number of posts to show per platform |
| Topic override | Optional manual topic for writing stages |
| Voice samples | Optional past scripts to help match a writing style |
| Transcript enrichment | Optional setting for media transcript enrichment |

### Center Area: Results

This is where the content intelligence appears.

Sections:

| Section | Purpose |
| --- | --- |
| Run status | Shows whether the run completed and how many posts were found |
| Trend board | Shows live Instagram posts in card format |
| Industry relevance brief | Explains why this content angle matters for the selected industry |
| Topic rankings | Shows the strongest topics and engagement signals |
| Script | Shows the generated short-form video script |
| Hooks | Shows the generated opening lines |
| Raw JSON payload | Technical export for debugging or integration |

### Right Panel: Operations

This is for system and campaign management.

Sections:

| Section | Purpose |
| --- | --- |
| Runtime | Shows storage and scheduler status |
| Campaigns | Shows saved recurring campaigns |
| Recent runs | Shows previous runs saved by the system |

## 8. The Four Skills In The System

The project is built around four content workflow skills.

| Skill | Plain-English Meaning | Output |
| --- | --- | --- |
| Content Scraper | Finds recent content from Instagram | Cards, links, thumbnails, metrics |
| Content Validator | Scores and groups the content | Topic rankings and recommendations |
| My Voice Writer | Writes a script in the intended tone | Short-form script |
| Hook Generator | Creates opening lines | Five hooks with recommendation |

The user can run one skill or all skills.

Recommended manager demo mode:

- Choose `Run all skills`
- Enter a keyword like `AI Marketing`
- Set lookback to `14`
- Set max posts to `5`
- Click the run button

## 9. What Happens Step By Step During A Full Run

### Step 1: User Enters A Keyword

Example:

```text
AI Marketing
```

The app cleans and expands broad phrases into Instagram-friendly search variations. For example, a phrase can be converted into hashtag-style searches so Instagram is more likely to return useful public posts.

### Step 2: Apify Collects Instagram Content

Apify acts as the data collection layer. The app sends the search request to the configured Instagram Apify actor.

The app requests:

- Public Instagram content
- Reels/posts related to the keyword
- Recent posts based on the lookback setting
- A limited number of results based on the max posts setting

### Step 3: The App Normalizes The Data

Different scraping outputs can have different field names. The app converts them into a consistent structure.

Normalized data includes:

| Data Point | Meaning |
| --- | --- |
| Platform | Instagram |
| Author handle | Account that posted the content |
| Source URL | Clickable link to the original post |
| Thumbnail URL | Image shown on the card |
| Caption | Text from the post |
| Views | View count when available |
| Likes | Like count when available |
| Comments | Comment count when available |
| Shares | Share count when available |
| Engagement rate | Engagement divided by views |
| Post date | When the content was posted |
| Format | Reel, post, or other content type |

### Step 4: The App Shows Cards

The app displays each post as a card.

Each card can show:

- Thumbnail
- Author
- Caption preview
- Views
- Engagement rate
- Topic
- Date
- Link to original Instagram post

This makes the research visually understandable for non-technical users.

### Step 5: OpenAI Analyzes The Content

OpenAI helps classify the posts into topics and buckets.

Example content buckets:

- Tutorial / Walkthrough
- Comparison / Alternatives
- Results / Case Study
- Mistake / Myth Busting
- Tool Spotlight
- Trend / Commentary

The goal is not just to show posts, but to identify what type of content pattern is working.

### Step 6: The App Recommends Topics

The app scores content based on:

- Views
- Engagement rate
- Comments
- Freshness
- Industry-specific weighting

Then it recommends the strongest content direction.

### Step 7: The App Builds An Industry Brief

The app adapts the recommendation based on the selected industry.

Current industry presets:

| Preset | Use Case |
| --- | --- |
| Agency / Social Team | Agencies and social media service providers |
| B2B SaaS / Thought Leadership | SaaS companies and experts |
| Creator Brand / Education | Creators, educators, coaches, consultants |
| D2C Brand / Social Commerce | Consumer brands and social commerce teams |

This keeps the output industry-relevant instead of generic.

### Step 8: The App Writes A Script

If `Run all skills` is selected, the app creates a short-form video script.

The script is structured into:

- Beat 1
- Beat 2
- Beat 3
- CTA

This makes it easy for a creator or marketer to record the video.

### Step 9: The App Generates Hooks

The app creates five hooks and recommends the strongest one.

Hook patterns include:

- Aspirational hook
- Pain point hook
- Curiosity hook
- Time or money claim
- Mistake or gap hook

### Step 10: The Run Is Saved

Every run creates a folder under:

```text
data/runs/<run-id>
```

Saved files include:

| File | Purpose |
| --- | --- |
| request.json | Stores the user input |
| scraped-posts.json | Stores the scraped data |
| scraped-posts.md | Human-readable scraped post summary |
| validation-report.json | Stores topic scoring and grouping |
| validation-report.md | Human-readable topic report |
| script.json | Stores generated script data |
| script.md | Human-readable script |
| hooks.json | Stores generated hooks |
| hooks.md | Human-readable hooks |
| pipeline-result.json | Full result payload |
| summary.md | Overall run summary |

## 10. Why The Project Uses Apify

Apify is used for data collection.

Reason:

- It avoids building a custom scraper from scratch
- It provides actor-based scraping workflows
- It can be swapped or adjusted without changing the whole app
- It gives a practical way to collect public social content for a prototype

Important note:

Apify results depend on the actor, target platform limits, public availability of data, and the quality of the input keyword. Some keywords return strong results, while very broad or private content may return fewer results.

## 11. Why The Project Uses OpenAI

OpenAI is used for intelligence and writing.

OpenAI helps with:

- Topic clustering
- Content bucket classification
- Industry-specific interpretation
- Script generation
- Hook generation
- Voice adaptation when examples are provided

The goal is not to fully replace the marketer. The goal is to reduce the manual research and first-draft writing effort.

## 12. Why SharePoint Was Chosen As The Database

SharePoint was chosen because the organization can use it as an internal business database without introducing a separate external database first.

Benefits:

- Business users can view data in SharePoint lists
- Access can be controlled using Microsoft 365 permissions
- Data can later be used in SPFx web parts
- It fits internal enterprise workflows
- It can integrate with Power Automate and Microsoft Graph

The app already has code prepared for three SharePoint lists:

| SharePoint List | Purpose |
| --- | --- |
| ASPI Content Pulse Runs | Stores each pipeline run |
| ASPI Content Pulse Posts | Stores individual scraped posts |
| ASPI Content Pulse Campaigns | Stores saved scheduled campaigns |

Current SharePoint status:

SharePoint is selected as part of the target architecture, but it is not connected yet. The app needs Microsoft Graph configuration values before it can write to SharePoint.

Missing values:

- SHAREPOINT_TENANT_ID
- SHAREPOINT_CLIENT_ID
- SHAREPOINT_CLIENT_SECRET
- SHAREPOINT_SITE_ID

Until these are added, the app saves everything locally.

## 13. Current Data Flow

Simple flow:

```text
User input
  -> Local web app
  -> Apify Instagram actor
  -> Normalized post data
  -> OpenAI analysis and writing
  -> Dashboard cards and reports
  -> Local saved files
  -> SharePoint later when configured
```

Production target flow:

```text
User input or saved campaign
  -> Scheduled app run
  -> Apify
  -> OpenAI
  -> SharePoint lists
  -> SPFx web part or dashboard
```

## 14. What The Manager Should See In A Demo

Recommended demo script:

1. Open `http://localhost:3000`
2. Enter keyword `AI Marketing`
3. Choose industry `Creator Brand / Education` or `Agency / Social Team`
4. Choose goal `Authority` or `Pipeline`
5. Select `Run all skills`
6. Set lookback to `14`
7. Set max posts to `5`
8. Click run
9. Show Instagram cards with thumbnails and links
10. Show topic rankings
11. Show generated script
12. Show generated hooks
13. Explain that the run is saved for audit and reuse

What to emphasize:

- This is not just an AI writer
- It starts with live content research
- It keeps proof links to original posts
- It turns research into writing output
- It can become a daily content intelligence system

## 15. What Is Already Real

Real components:

- The local dashboard is working
- Apify is connected
- OpenAI is connected
- Instagram results can return live cards
- Original Instagram links can open from the cards
- Runs are stored locally
- Campaign save and scheduler logic exist
- SharePoint integration code exists

Not fake:

- The cards can come from live Apify results
- The generated scripts and hooks are generated from the pipeline
- Local run files are actually written to disk

Fallback behavior:

- If scraping returns no public posts, the app shows a clear message
- If SharePoint is not configured, the app saves locally
- If a partial skill is selected, later stages are intentionally skipped

## 16. What Is Still Prototype-Level

The current version is not yet a fully production-ready SaaS.

Prototype limitations:

- Runs locally on one machine
- SharePoint credentials are not configured yet
- User login and role permissions are not implemented
- No production hosting has been configured
- No billing or tenant separation exists
- Scheduler works only while the Node server is running
- Error handling is improved but still basic
- Instagram scraping depends on Apify actor behavior
- Not all edge cases have been tested at scale

## 17. Production Improvements Needed

To make this production-ready, the following should be added.

| Area | Improvement Needed |
| --- | --- |
| Hosting | Move from local machine to Azure App Service or similar |
| Storage | Complete SharePoint or database integration |
| Authentication | Add Microsoft login or internal access control |
| Scheduling | Use a reliable cloud scheduler instead of only local process timing |
| Monitoring | Add logs, alerts, and failure tracking |
| Data quality | Add duplicate detection and source quality scoring |
| Security | Store API keys in Key Vault or secure environment variables |
| UX | Add export buttons, filters, and saved views |
| Governance | Add usage rules for public data and content review |
| Performance | Queue long-running scraping jobs |

## 18. Risks And Controls

| Risk | Explanation | Control |
| --- | --- | --- |
| Platform data changes | Instagram or Apify actor output may change | Keep scraper layer modular |
| Empty results | Some keywords may return no public posts | Use better keyword expansion and competitor handles |
| API cost | Apify and OpenAI calls may cost money | Add usage limits and campaign controls |
| Data privacy | API keys and credentials must not be exposed | Use environment variables and secure storage |
| Over-reliance on AI | AI output may need review | Keep human approval before publishing |
| SharePoint setup delay | Microsoft Graph setup needs admin values | Treat local storage as fallback until configured |

## 19. Security Notes For Management

Important:

- API keys should never be shared in screenshots or documents
- Production credentials should not be stored directly in code
- SharePoint access should use approved Microsoft Entra app registration
- Only public social content should be collected
- Generated content should be reviewed by a human before publishing

## 20. Cost Considerations

Main cost areas:

- Apify usage for scraping
- OpenAI usage for analysis and writing
- Hosting if deployed to Azure or another cloud
- SharePoint is usually already part of Microsoft 365 if the company uses it

Cost can be controlled by:

- Limiting max posts per run
- Scheduling only important campaigns
- Caching run results
- Avoiding unnecessary full-pipeline runs
- Using scraper-only runs for quick research

## 21. What Makes This Industry-Relevant

The app is not positioned as a generic AI content tool.

It is designed around:

- Live market signals
- Industry-specific goals
- Content bucket detection
- Repeatable campaign workflows
- SharePoint-first enterprise storage
- Human-readable and machine-readable outputs

This makes it more suitable for agency and enterprise workflows than a simple prompt-based writing tool.

## 22. How A Manager Can Judge Success

Useful success metrics:

| Metric | Why It Matters |
| --- | --- |
| Time saved per content research task | Measures operational efficiency |
| Number of useful ideas generated per run | Measures output quality |
| Number of live posts found per keyword | Measures data usefulness |
| Script acceptance rate | Measures writing usefulness |
| Hook acceptance rate | Measures creative usefulness |
| Campaigns run per week | Measures repeatability |
| Content created from validated ideas | Measures business impact |

## 23. Recommended Next Steps

Short-term next steps:

1. Finalize the manager demo flow
2. Connect SharePoint using Microsoft Graph credentials
3. Add export buttons for reports
4. Add filters for views, engagement rate, and content bucket
5. Add a simple admin settings page

Medium-term next steps:

1. Deploy the app to a stable server
2. Add Microsoft login
3. Store all runs in SharePoint
4. Build an SPFx web part to display SharePoint data
5. Add daily automated campaigns

Long-term next steps:

1. Add more platforms if needed
2. Add multi-user workflows
3. Add approval status for generated scripts
4. Add team reporting dashboards
5. Add campaign performance feedback after publishing

## 24. One-Minute Manager Pitch

ASPI Content Pulse is a working prototype that turns live Instagram trend research into structured content recommendations, scripts, and hooks. A marketer enters a keyword, the system finds relevant public Instagram content using Apify, analyzes the patterns with OpenAI, displays the posts as clickable cards, ranks the best topics, and generates content outputs. It currently runs locally and saves data locally, with SharePoint integration prepared for enterprise storage once Microsoft credentials are connected. The goal is to reduce manual research time, make content decisions more evidence-based, and create a repeatable daily content intelligence workflow.

## 25. Current Status In One Line

The prototype works end to end locally with live Instagram data and OpenAI-generated outputs; SharePoint storage is the main pending production integration.
