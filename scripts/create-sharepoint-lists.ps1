param(
  [Parameter(Mandatory = $true)]
  [string]$SiteUrl,

  [string]$RunsListName = "ASPI Content Pulse Runs",
  [string]$PostsListName = "ASPI Content Pulse Posts",
  [string]$CampaignsListName = "ASPI Content Pulse Campaigns"
)

$ErrorActionPreference = "Stop"

function Ensure-Module {
  if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    throw "PnP.PowerShell is not installed. Install it in PowerShell 7 with: Install-Module PnP.PowerShell -Scope CurrentUser"
  }
}

function Ensure-List {
  param(
    [string]$Title
  )

  $list = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
  if (-not $list) {
    New-PnPList -Title $Title -Template GenericList -OnQuickLaunch | Out-Null
  }
}

function Ensure-Field {
  param(
    [string]$ListTitle,
    [string]$DisplayName,
    [string]$InternalName,
    [string]$Type
  )

  $field = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction SilentlyContinue
  if ($field) {
    return
  }

  Add-PnPField -List $ListTitle -DisplayName $DisplayName -InternalName $InternalName -Type $Type -AddToDefaultView | Out-Null
}

Ensure-Module
Connect-PnPOnline -Url $SiteUrl -Interactive

Ensure-List -Title $RunsListName
Ensure-Field -ListTitle $RunsListName -DisplayName "RunId" -InternalName "RunId" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "CampaignId" -InternalName "CampaignId" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "CampaignName" -InternalName "CampaignName" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "StorageVersion" -InternalName "StorageVersion" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "RunStatus" -InternalName "RunStatus" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "IndustryPreset" -InternalName "IndustryPreset" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "TeamModel" -InternalName "TeamModel" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "PrimaryGoal" -InternalName "PrimaryGoal" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "RunTarget" -InternalName "RunTarget" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "Keywords" -InternalName "Keywords" -Type Note
Ensure-Field -ListTitle $RunsListName -DisplayName "Platforms" -InternalName "Platforms" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "ScrapeMode" -InternalName "ScrapeMode" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "ScrapedPosts" -InternalName "ScrapedPosts" -Type Number
Ensure-Field -ListTitle $RunsListName -DisplayName "ContentBuckets" -InternalName "ContentBuckets" -Type Number
Ensure-Field -ListTitle $RunsListName -DisplayName "RankedTopics" -InternalName "RankedTopics" -Type Number
Ensure-Field -ListTitle $RunsListName -DisplayName "RecommendedTopic" -InternalName "RecommendedTopic" -Type Text
Ensure-Field -ListTitle $RunsListName -DisplayName "ResultJson" -InternalName "ResultJson" -Type Note

Ensure-List -Title $PostsListName
Ensure-Field -ListTitle $PostsListName -DisplayName "RunId" -InternalName "RunId" -Type Text
Ensure-Field -ListTitle $PostsListName -DisplayName "CampaignId" -InternalName "CampaignId" -Type Text
Ensure-Field -ListTitle $PostsListName -DisplayName "CampaignName" -InternalName "CampaignName" -Type Text
Ensure-Field -ListTitle $PostsListName -DisplayName "PostId" -InternalName "PostId" -Type Text
Ensure-Field -ListTitle $PostsListName -DisplayName "Platform" -InternalName "Platform" -Type Text
Ensure-Field -ListTitle $PostsListName -DisplayName "ContentFormat" -InternalName "ContentFormat" -Type Text
Ensure-Field -ListTitle $PostsListName -DisplayName "AuthorHandle" -InternalName "AuthorHandle" -Type Text
Ensure-Field -ListTitle $PostsListName -DisplayName "SourceUrl" -InternalName "SourceUrl" -Type Note
Ensure-Field -ListTitle $PostsListName -DisplayName "ThumbnailUrl" -InternalName "ThumbnailUrl" -Type Note
Ensure-Field -ListTitle $PostsListName -DisplayName "Topic" -InternalName "Topic" -Type Text
Ensure-Field -ListTitle $PostsListName -DisplayName "Bucket" -InternalName "Bucket" -Type Text
Ensure-Field -ListTitle $PostsListName -DisplayName "Views" -InternalName "Views" -Type Number
Ensure-Field -ListTitle $PostsListName -DisplayName "Likes" -InternalName "Likes" -Type Number
Ensure-Field -ListTitle $PostsListName -DisplayName "Comments" -InternalName "Comments" -Type Number
Ensure-Field -ListTitle $PostsListName -DisplayName "Shares" -InternalName "Shares" -Type Number
Ensure-Field -ListTitle $PostsListName -DisplayName "EngagementRate" -InternalName "EngagementRate" -Type Number
Ensure-Field -ListTitle $PostsListName -DisplayName "PostDate" -InternalName "PostDate" -Type DateTime
Ensure-Field -ListTitle $PostsListName -DisplayName "ViralTag" -InternalName "ViralTag" -Type Boolean
Ensure-Field -ListTitle $PostsListName -DisplayName "PayloadJson" -InternalName "PayloadJson" -Type Note

Ensure-List -Title $CampaignsListName
Ensure-Field -ListTitle $CampaignsListName -DisplayName "CampaignId" -InternalName "CampaignId" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "CampaignStatus" -InternalName "CampaignStatus" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "IndustryPreset" -InternalName "IndustryPreset" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "TeamModel" -InternalName "TeamModel" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "PrimaryGoal" -InternalName "PrimaryGoal" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "RunTarget" -InternalName "RunTarget" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "Keywords" -InternalName "Keywords" -Type Note
Ensure-Field -ListTitle $CampaignsListName -DisplayName "Competitors" -InternalName "Competitors" -Type Note
Ensure-Field -ListTitle $CampaignsListName -DisplayName "Platforms" -InternalName "Platforms" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "LookbackDays" -InternalName "LookbackDays" -Type Number
Ensure-Field -ListTitle $CampaignsListName -DisplayName "MaxItemsPerPlatform" -InternalName "MaxItemsPerPlatform" -Type Number
Ensure-Field -ListTitle $CampaignsListName -DisplayName "ScheduleTime" -InternalName "ScheduleTime" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "TimeZone" -InternalName "TimeZone" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "LastRunAt" -InternalName "LastRunAt" -Type DateTime
Ensure-Field -ListTitle $CampaignsListName -DisplayName "NextRunAt" -InternalName "NextRunAt" -Type DateTime
Ensure-Field -ListTitle $CampaignsListName -DisplayName "LastRunId" -InternalName "LastRunId" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "LastStatus" -InternalName "LastStatus" -Type Text
Ensure-Field -ListTitle $CampaignsListName -DisplayName "LastError" -InternalName "LastError" -Type Note
Ensure-Field -ListTitle $CampaignsListName -DisplayName "CampaignJson" -InternalName "CampaignJson" -Type Note

Write-Host "SharePoint lists are ready:"
Write-Host "- $RunsListName"
Write-Host "- $PostsListName"
Write-Host "- $CampaignsListName"
