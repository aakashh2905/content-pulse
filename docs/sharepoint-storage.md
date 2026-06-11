# SharePoint Storage Setup

This app supports SharePoint as the production database through Microsoft Graph.

## Runtime Flow

1. The app runs the content pipeline.
2. Local JSON/Markdown files are still written as a backup.
3. If `STORAGE_PROVIDER=hybrid` or `STORAGE_PROVIDER=sharepoint` and Graph credentials are configured, the app writes:
   - one row into `ASPI Content Pulse Runs`
   - one row per scraped social post into `ASPI Content Pulse Posts`
   - one row per saved automated campaign into `ASPI Content Pulse Campaigns`
4. `/api/runs` reads recent run history from SharePoint when configured, otherwise from local files.

## Required App Registration

Create an Entra app registration with Microsoft Graph application permissions:

- `Sites.ReadWrite.All`

Then grant admin consent and add these values to `.env.local`:

```ini
STORAGE_PROVIDER=hybrid
SHAREPOINT_TENANT_ID=
SHAREPOINT_CLIENT_ID=
SHAREPOINT_CLIENT_SECRET=
SHAREPOINT_SITE_ID=
SHAREPOINT_RUNS_LIST_NAME=ASPI Content Pulse Runs
SHAREPOINT_POSTS_LIST_NAME=ASPI Content Pulse Posts
SHAREPOINT_CAMPAIGNS_LIST_NAME=ASPI Content Pulse Campaigns
```

`SHAREPOINT_SITE_ID` can be the Graph site id or a Graph site path such as:

```text
contoso.sharepoint.com:/sites/Marketing:
```

## Lists

Create three SharePoint lists.

### ASPI Content Pulse Runs

| Internal Name | Type |
| --- | --- |
| Title | Text |
| RunId | Text |
| CampaignId | Text |
| CampaignName | Text |
| StorageVersion | Text |
| RunStatus | Text |
| IndustryPreset | Text |
| TeamModel | Text |
| PrimaryGoal | Text |
| RunTarget | Text |
| Keywords | Note |
| Platforms | Text |
| ScrapeMode | Text |
| ScrapedPosts | Number |
| ContentBuckets | Number |
| RankedTopics | Number |
| RecommendedTopic | Text |
| ResultJson | Note |

### ASPI Content Pulse Posts

| Internal Name | Type |
| --- | --- |
| Title | Text |
| RunId | Text |
| CampaignId | Text |
| CampaignName | Text |
| PostId | Text |
| Platform | Text |
| ContentFormat | Text |
| AuthorHandle | Text |
| SourceUrl | Note |
| ThumbnailUrl | Note |
| Topic | Text |
| Bucket | Text |
| Views | Number |
| Likes | Number |
| Comments | Number |
| Shares | Number |
| EngagementRate | Number |
| PostDate | DateTime |
| ViralTag | Boolean |
| PayloadJson | Note |

### ASPI Content Pulse Campaigns

| Internal Name | Type |
| --- | --- |
| Title | Text |
| CampaignId | Text |
| CampaignStatus | Text |
| IndustryPreset | Text |
| TeamModel | Text |
| PrimaryGoal | Text |
| RunTarget | Text |
| Keywords | Note |
| Competitors | Note |
| Platforms | Text |
| LookbackDays | Number |
| MaxItemsPerPlatform | Number |
| ScheduleTime | Text |
| TimeZone | Text |
| LastRunAt | DateTime |
| NextRunAt | DateTime |
| LastRunId | Text |
| LastStatus | Text |
| LastError | Note |
| CampaignJson | Note |

## One-Time Provisioning

Use `scripts/create-sharepoint-lists.ps1` if you have PnP.PowerShell available.

```powershell
pwsh .\scripts\create-sharepoint-lists.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/Marketing"
```

After the lists exist, run the app and check `/api/health`. It should show SharePoint storage as configured.

## Campaign Automation

The local server includes an in-process scheduler. It checks active campaigns every minute and runs each campaign once per local day after its `ScheduleTime`.

Campaign API:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/campaigns` | List saved campaigns |
| POST | `/api/campaigns` | Save a campaign |
| PATCH | `/api/campaigns/{campaignId}` | Update status or settings |
| DELETE | `/api/campaigns/{campaignId}` | Delete a campaign |
| POST | `/api/campaigns/{campaignId}/run` | Run one campaign immediately |
| POST | `/api/scheduler/run-due` | Run all currently due campaigns |

For unattended production use, keep this Node process running on a server or Azure App Service. If the process is stopped, scheduled campaigns will not run until it starts again.
