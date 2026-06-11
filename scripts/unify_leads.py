from __future__ import annotations

import argparse
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd


SOURCE_FILES = [
    "Bangalore IT Consulting Companies - CEO & Decision Makers Research.xlsx",
    "Clients to Pitch.xlsx",
    "IT email linkedin.xlsx",
    "IT_Companies_Combined.xlsx",
    "scrapped.xlsx",
]

FINAL_COLUMNS = [
    "Person Name",
    "Company Name",
    "Industry",
    "Designation",
    "Contact",
    "Email",
    "Phone",
    "LinkedIn",
    "Website",
    "Instagram",
    "Address",
    "City",
    "State",
    "Country",
    "Followers",
    "Employee Size",
    "Source File",
    "Source Sheet",
    "Notes",
    "Data Completeness Score",
]

ROLE_KEYWORDS = {
    "owner",
    "founder",
    "co-founder",
    "ceo",
    "cto",
    "cfo",
    "coo",
    "director",
    "manager",
    "head",
    "chef",
    "chairman",
    "vice president",
    "president",
    "partner",
    "associate",
    "account",
    "finance",
    "people strategy",
    "engineering",
    "lead",
    "md",
    "managing director",
    "svp",
}

COMPANY_WORDS = {
    "pvt",
    "ltd",
    "llp",
    "private",
    "limited",
    "consulting",
    "consultants",
    "technologies",
    "technology",
    "tech",
    "systems",
    "services",
    "solutions",
    "digital",
    "hospitality",
    "realities",
    "infra",
    "company",
    "group",
    "cafe",
    "bakery",
    "jewellery",
    "apparels",
    "foods",
    "food",
    "store",
    "website",
}

EMAIL_RE = re.compile(r"(?i)\b[a-z0-9._%+\-*]+@[a-z0-9.-]+\.[a-z]{2,}\b")
LINKEDIN_RE = re.compile(
    r"(?i)\b(?:https?://)?(?:(?:[\w-]+\.)?linkedin\.com|in\.linkedin\.com)/[^\s|,;]+"
)
URL_RE = re.compile(r"(?i)\b(?:https?://|www\.)[^\s|,;]+")
PHONE_CANDIDATE_RE = re.compile(r"(?<!\w)(?:\+?\d[\d()./\- \t]{6,}\d)")

CITY_PATTERNS = {
    "bengaluru": "Bengaluru",
    "bangalore": "Bengaluru",
    "mumbai": "Mumbai",
    "pune": "Pune",
    "gurugram": "Gurugram",
    "gurgaon": "Gurugram",
    "chennai": "Chennai",
    "hyderabad": "Hyderabad",
    "noida": "Noida",
    "delhi": "Delhi",
    "uttarakhand": "Uttarakhand",
    "whitefield": "Bengaluru",
    "indiranagar": "Bengaluru",
    "jayanagar": "Bengaluru",
}

STATE_PATTERNS = {
    "karnataka": "Karnataka",
    "maharashtra": "Maharashtra",
    "uttarakhand": "Uttarakhand",
    "tamil nadu": "Tamil Nadu",
    "telangana": "Telangana",
    "delhi": "Delhi",
    "haryana": "Haryana",
}

CITY_TO_STATE = {
    "Bengaluru": "Karnataka",
    "Mumbai": "Maharashtra",
    "Pune": "Maharashtra",
    "Gurugram": "Haryana",
    "Chennai": "Tamil Nadu",
    "Hyderabad": "Telangana",
    "Noida": "Uttar Pradesh",
    "Delhi": "Delhi",
}


class DisjointSet:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))
        self.rank = [0] * size

    def find(self, item: int) -> int:
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root == right_root:
            return
        if self.rank[left_root] < self.rank[right_root]:
            left_root, right_root = right_root, left_root
        self.parent[right_root] = left_root
        if self.rank[left_root] == self.rank[right_root]:
            self.rank[left_root] += 1


def clean_text(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    text = str(value).replace("\u00a0", " ").replace("\u200b", "").strip()
    if not text or text.lower() in {"nan", "none", "null", "0", "-", "--", "n/a", "na"}:
        return ""
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", "\n", text)
    return text.strip()


def single_line(value: object) -> str:
    return re.sub(r"\s*\n\s*", " | ", clean_text(value))


def normalize_key(value: str) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def normalize_url(value: str) -> str:
    text = clean_text(value)
    if not text:
        return ""
    if text.lower().startswith("www."):
        return f"https://{text}"
    if text.lower().startswith("in.linkedin.com/"):
        return f"https://{text}"
    return text


def normalize_email(value: str) -> str:
    email = clean_text(value).lower().rstrip(").,;:")
    email = re.sub(r"(com|net|org|in|co|biz|io)plus$", r"\1", email)
    return email


def unique_join(parts: list[str], sep: str = " | ") -> str:
    seen: set[str] = set()
    result: list[str] = []
    for part in parts:
        cleaned = clean_text(part)
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            result.append(cleaned)
    return sep.join(result)


def merge_unique(existing: str, new_value: str, sep: str = " | ") -> str:
    if not existing:
        return clean_text(new_value)
    if not new_value:
        return clean_text(existing)
    return unique_join(existing.split(sep) + [new_value], sep=sep)


def phone_key(value: str) -> str:
    digits = re.sub(r"\D", "", clean_text(value))
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 12 and digits.startswith("91"):
        return digits[-10:]
    return digits


def merge_phones(existing: str, new_value: str) -> str:
    values = []
    if existing:
        values.extend(existing.split(" | "))
    if new_value:
        values.extend(new_value.split(" | "))

    seen: dict[str, str] = {}
    for value in values:
        normalized = normalize_phone(value)
        if not normalized:
            continue
        key = phone_key(normalized)
        if not key:
            continue
        current = seen.get(key, "")
        if not current or normalized.startswith("+") or signal_score(normalized) > signal_score(current):
            seen[key] = normalized
    return " | ".join(seen.values())


def signal_score(value: str) -> int:
    text = clean_text(value)
    if not text:
        return 0
    return len(re.sub(r"[^A-Za-z0-9]+", "", text))


def choose_richer(existing: str, candidate: str) -> str:
    existing = clean_text(existing)
    candidate = clean_text(candidate)
    if not existing:
        return candidate
    if not candidate:
        return existing
    if existing.lower() == candidate.lower():
        return existing
    return candidate if signal_score(candidate) > signal_score(existing) else existing


def normalize_phone(value: str) -> str:
    text = clean_text(value)
    digits = re.sub(r"\D", "", text)
    if not digits:
        return ""
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 12 and digits.startswith("91"):
        return f"+91{digits[-10:]}"
    if text.strip().startswith("+"):
        return f"+{digits}"
    return digits


def extract_emails(value: str) -> list[str]:
    return [normalize_email(match) for match in EMAIL_RE.findall(clean_text(value))]


def extract_linkedin_urls(value: str) -> list[str]:
    return [normalize_url(match.rstrip(").,")) for match in LINKEDIN_RE.findall(clean_text(value))]


def extract_urls(value: str) -> list[str]:
    return [normalize_url(match.rstrip(").,")) for match in URL_RE.findall(clean_text(value))]


def extract_phones(value: str) -> list[str]:
    results: list[str] = []
    for match in PHONE_CANDIDATE_RE.findall(clean_text(value)):
        normalized = normalize_phone(match)
        digits = normalized.lstrip("+")
        if 7 <= len(digits) <= 12:
            results.append(normalized)
    return list(dict.fromkeys(results))


def strip_known_entities(value: str) -> str:
    text = clean_text(value)
    if not text:
        return ""
    text = EMAIL_RE.sub(" ", text)
    text = LINKEDIN_RE.sub(" ", text)
    text = URL_RE.sub(" ", text)
    text = PHONE_CANDIDATE_RE.sub(" ", text)
    text = text.replace("(plus)", " ")
    text = re.sub(r"(?i)\b(phone|email|linkedin|insta|instagram|whatsapp|whatsApp|zomato|google|number|contact)\b\s*:?", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" -|,:")


def looks_like_person_name(value: str) -> bool:
    text = strip_known_entities(value)
    if not text or any(char.isdigit() for char in text):
        return False
    if "&" in text or "/" in text or " and " in text.lower():
        return False
    lowered = text.lower()
    if "team" in lowered:
        return False
    if any(word in lowered for word in COMPANY_WORDS):
        return False
    if any(keyword in lowered for keyword in ROLE_KEYWORDS) and "(" not in text and ")" not in text:
        return False
    words = [word for word in re.split(r"\s+", text) if word]
    if not 2 <= len(words) <= 5:
        return False
    return all(re.fullmatch(r"[A-Za-z.'-]+", word) for word in words)


def split_name_designation(value: str) -> tuple[str, str, str]:
    text = strip_known_entities(value)
    if not text:
        return "", "", ""

    if ":" in text:
        prefix, suffix = [segment.strip() for segment in text.split(":", 1)]
        prefix_lower = prefix.lower()
        if any(keyword in prefix_lower for keyword in ROLE_KEYWORDS):
            if looks_like_person_name(suffix):
                return suffix, prefix, ""
            return "", prefix, suffix

    match = re.match(r"^(?P<name>.+?)\s*\((?P<title>[^()]+)\)$", text)
    if match:
        name = match.group("name").strip()
        title = match.group("title").strip()
        if looks_like_person_name(name):
            return name, title, ""

    if " - " in text:
        left, right = [segment.strip() for segment in text.split(" - ", 1)]
        if looks_like_person_name(left):
            return left, right, ""

    if looks_like_person_name(text):
        return text, "", ""

    lowered = text.lower()
    if any(keyword in lowered for keyword in ROLE_KEYWORDS):
        return "", text, ""

    return "", "", text


def derive_company_from_website(value: str) -> str:
    url = normalize_url(value)
    if not url:
        return ""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = parsed.netloc or parsed.path
    host = host.lower().split("@")[-1]
    for prefix in ("www.",):
        if host.startswith(prefix):
            host = host[len(prefix) :]
    name = host.split(".")[0]
    name = re.sub(r"[-_]+", " ", name).strip()
    return name.title()


def infer_location_fields(address: str) -> tuple[str, str, str]:
    text = clean_text(address).lower()
    city = ""
    state = ""
    country = ""
    for pattern, value in CITY_PATTERNS.items():
        if pattern in text:
            city = value
            break
    for pattern, value in STATE_PATTERNS.items():
        if pattern in text:
            state = value
            break
    if not state and city in CITY_TO_STATE:
        state = CITY_TO_STATE[city]
    if text:
        if any(token in text for token in ("india", "karnataka", "maharashtra", "gurugram", "bengaluru", "bangalore")):
            country = "India"
        elif any(token in text for token in ("usa", "united states")):
            country = "United States"
    return city, state, country


def normalize_company_name(company: str, website: str = "") -> str:
    company = clean_text(company)
    if not company:
        return derive_company_from_website(website)
    if URL_RE.fullmatch(company) or re.fullmatch(r"(?i)(?:https?://)?(?:www\.)?[\w.-]+\.[a-z]{2,}(?:/.*)?", company):
        return derive_company_from_website(company)
    return company


def record_template(source_file: str, source_sheet: str) -> dict[str, str]:
    row = {column: "" for column in FINAL_COLUMNS}
    row["Source File"] = source_file
    row["Source Sheet"] = source_sheet
    return row


def add_misc_contact_data(record: dict[str, str], *values: str) -> None:
    leftovers: list[str] = []
    for value in values:
        text = clean_text(value)
        if not text:
            continue

        for email in extract_emails(text):
            record["Email"] = merge_unique(record["Email"], email)
        for linkedin in extract_linkedin_urls(text):
            record["LinkedIn"] = merge_unique(record["LinkedIn"], linkedin)
        urls = [url for url in extract_urls(text) if url not in extract_linkedin_urls(text)]
        for url in urls:
            lowered = url.lower()
            if "instagram.com" in lowered:
                record["Instagram"] = merge_unique(record["Instagram"], url)
            elif not record["Website"]:
                record["Website"] = choose_richer(record["Website"], url)
            else:
                record["Notes"] = merge_unique(record["Notes"], f"Extra URL: {url}")
        phone_text = clean_text(EMAIL_RE.sub(" ", LINKEDIN_RE.sub(" ", URL_RE.sub(" ", text))))
        for phone in extract_phones(phone_text):
            record["Phone"] = merge_phones(record["Phone"], phone)

        segments = [segment.strip() for segment in re.split(r"\n+|\|", text) if clean_text(segment)]
        if not segments:
            segments = [text]

        for segment in segments:
            person, designation, leftover = split_name_designation(segment)
            if person:
                record["Person Name"] = choose_richer(record["Person Name"], person)
            if designation:
                record["Designation"] = merge_unique(record["Designation"], designation)
            if leftover:
                leftovers.append(leftover)

    if leftovers:
        record["Contact"] = merge_unique(record["Contact"], unique_join(leftovers))


def add_channel_data(record: dict[str, str], *values: str) -> None:
    for value in values:
        text = clean_text(value)
        if not text:
            continue
        for email in extract_emails(text):
            record["Email"] = merge_unique(record["Email"], email)
        for linkedin in extract_linkedin_urls(text):
            record["LinkedIn"] = merge_unique(record["LinkedIn"], linkedin)
        urls = [url for url in extract_urls(text) if url not in extract_linkedin_urls(text)]
        for url in urls:
            lowered = url.lower()
            if "instagram.com" in lowered:
                record["Instagram"] = merge_unique(record["Instagram"], url)
            elif not record["Website"]:
                record["Website"] = choose_richer(record["Website"], url)
        phone_text = clean_text(EMAIL_RE.sub(" ", LINKEDIN_RE.sub(" ", URL_RE.sub(" ", text))))
        for phone in extract_phones(phone_text):
            record["Phone"] = merge_phones(record["Phone"], phone)


def classify_profile_link(record: dict[str, str], value: str) -> None:
    url = normalize_url(value)
    if not url:
        return
    lowered = url.lower()
    if "linkedin.com" in lowered or "in.linkedin.com" in lowered:
        record["LinkedIn"] = merge_unique(record["LinkedIn"], url)
    elif "instagram.com" in lowered or lowered.startswith("@"):
        record["Instagram"] = merge_unique(record["Instagram"], url)
    else:
        record["Website"] = choose_richer(record["Website"], url)


def finalize_record(record: dict[str, str]) -> dict[str, str] | None:
    record = {key: clean_text(value) for key, value in record.items()}

    if not record["Company Name"] and record["Website"]:
        record["Company Name"] = derive_company_from_website(record["Website"])
    record["Company Name"] = normalize_company_name(record["Company Name"], record["Website"])

    if record["Company Name"] and "@" in record["Company Name"] and record["Designation"] == "":
        before, after = [segment.strip() for segment in record["Company Name"].split("@", 1)]
        before_lower = before.lower()
        if after and any(keyword in before_lower for keyword in ROLE_KEYWORDS):
            record["Company Name"] = after
            record["Designation"] = before

    if record["Address"]:
        city, state, country = infer_location_fields(record["Address"])
        record["City"] = choose_richer(record["City"], city)
        record["State"] = choose_richer(record["State"], state)
        record["Country"] = choose_richer(record["Country"], country)

    if not any(record[field] for field in ("Company Name", "Person Name", "Email", "Phone", "LinkedIn", "Website", "Instagram", "Address")):
        return None

    completeness_fields = [
        "Person Name",
        "Company Name",
        "Industry",
        "Designation",
        "Contact",
        "Email",
        "Phone",
        "LinkedIn",
        "Website",
        "Instagram",
        "Address",
        "City",
        "State",
        "Country",
        "Followers",
        "Employee Size",
    ]
    score = sum(1 for field in completeness_fields if record[field])
    record["Data Completeness Score"] = str(score)
    return record


def extract_bangalore_it(path: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    workbook = pd.ExcelFile(path)

    sheet1 = pd.read_excel(path, sheet_name="Sheet1")
    for _, row in sheet1.iterrows():
        company = clean_text(row.get("Company Name"))
        if not company:
            continue

        base = record_template(path.name, "Sheet1")
        base["Company Name"] = company
        base["Industry"] = "IT Consulting"
        base["Phone"] = merge_phones("", unique_join(extract_phones(clean_text(row.get("Phone")))))
        base["Website"] = normalize_url(clean_text(row.get("Website")))
        base["Notes"] = single_line(row.get("Notes"))

        ceo_name = clean_text(row.get("CEO/Founder Name"))
        ceo_linkedin = clean_text(row.get("CEO LinkedIn Profile"))
        if not ceo_linkedin and extract_linkedin_urls(ceo_name):
            ceo_linkedin = unique_join(extract_linkedin_urls(ceo_name))
            ceo_name = strip_known_entities(ceo_name)

        ceo_record = base.copy()
        ceo_record["Designation"] = "CEO/Founder"
        ceo_record["Person Name"] = ceo_name
        ceo_record["Email"] = unique_join(extract_emails(clean_text(row.get("CEO Email"))))
        ceo_record["LinkedIn"] = merge_unique(ceo_record["LinkedIn"], ceo_linkedin)
        ceo_record = finalize_record(ceo_record)
        if ceo_record:
            records.append(ceo_record)

        decision_record = base.copy()
        decision_record["Designation"] = "Decision Maker"
        decision_record["Person Name"] = clean_text(row.get("Decision Maker Name"))
        decision_record["Email"] = unique_join(extract_emails(clean_text(row.get("Decision Maker Email"))))
        decision_record["LinkedIn"] = unique_join(extract_linkedin_urls(clean_text(row.get("Decision Maker Profile"))))
        decision_record = finalize_record(decision_record)
        if decision_record and any(
            decision_record[field] for field in ("Person Name", "Email", "LinkedIn")
        ):
            records.append(decision_record)

        if not any(
            clean_text(row.get(field))
            for field in ("CEO/Founder Name", "CEO LinkedIn Profile", "CEO Email", "Decision Maker Name", "Decision Maker Profile", "Decision Maker Email")
        ):
            company_record = finalize_record(base)
            if company_record:
                records.append(company_record)

    if "Sheet2" in workbook.sheet_names:
        sheet2 = pd.read_excel(path, sheet_name="Sheet2")
        for _, row in sheet2.iterrows():
            company = clean_text(row.iloc[0])
            if not company:
                continue
            recovered = record_template(path.name, "Sheet2")
            recovered["Company Name"] = company
            recovered["Industry"] = "IT Consulting"
            recovered["Notes"] = "Recovered from malformed source sheet."
            possible_url = clean_text(row.get("Unnamed: 10"))
            classify_profile_link(recovered, possible_url)
            recovered = finalize_record(recovered)
            if recovered:
                records.append(recovered)

    return records


def extract_it_email_linkedin(path: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    sheet = pd.read_excel(path, sheet_name=0)
    for _, row in sheet.iterrows():
        raw_company = clean_text(row.iloc[0] if len(row) > 0 else "")
        raw_person = clean_text(row.iloc[1] if len(row) > 1 else "")
        raw_misc = clean_text(row.iloc[2] if len(row) > 2 else "")

        record = record_template(path.name, "Sheet1")
        record["Industry"] = "IT / Technology"

        if "@" in raw_company and "linkedin.com" not in raw_company.lower() and not raw_company.lower().startswith("www."):
            maybe_title, maybe_company = [segment.strip() for segment in raw_company.split("@", 1)]
            record["Designation"] = maybe_title
            record["Company Name"] = maybe_company
        else:
            record["Company Name"] = raw_company

        if raw_company.lower().startswith("www.") or re.fullmatch(
            r"(?i)(?:https?://)?(?:www\.)?[\w.-]+\.[a-z]{2,}(?:/.*)?",
            raw_company,
        ):
            record["Website"] = normalize_url(raw_company)

        record["Person Name"] = raw_person
        add_misc_contact_data(record, raw_misc)

        finalized = finalize_record(record)
        if finalized:
            records.append(finalized)
    return records


def extract_it_companies_combined(path: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    sheet = pd.read_excel(path, sheet_name=0)
    for _, row in sheet.iterrows():
        record = record_template(path.name, "IT_Companies_Combined")
        record["Company Name"] = clean_text(row.get("Company Name"))
        record["Industry"] = clean_text(row.get("Industry"))
        record["Person Name"] = clean_text(row.get("CEO / Founder"))
        record["Designation"] = clean_text(row.get("Title"))
        record["Email"] = unique_join(extract_emails(clean_text(row.get("Email"))))
        record["Phone"] = merge_phones("", unique_join(extract_phones(clean_text(row.get("Phone")))))
        record["Website"] = normalize_url(clean_text(row.get("Website")))
        record["LinkedIn"] = unique_join(extract_linkedin_urls(clean_text(row.get("LinkedIn"))))
        record["Employee Size"] = clean_text(row.get("Employee Size"))
        finalized = finalize_record(record)
        if finalized:
            records.append(finalized)
    return records


def extract_scrapped(path: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    sheet = pd.read_excel(path, sheet_name=0)
    for _, row in sheet.iterrows():
        record = record_template(path.name, "Recovered_Sheet1")
        record["Company Name"] = clean_text(row.get("Business Name"))
        record["Industry"] = clean_text(row.get("Type"))
        record["Address"] = clean_text(row.get("Location"))
        record["Website"] = normalize_url(clean_text(row.get("Website")))
        record["Instagram"] = clean_text(row.get("Instagram"))
        add_misc_contact_data(
            record,
            clean_text(row.get("CEO/Owner/Decision Maker")),
            clean_text(row.get("Email/Linkedin")),
            clean_text(row.get("LinkedIn Profile")),
            clean_text(row.get("Phone")),
        )
        finalized = finalize_record(record)
        if finalized:
            records.append(finalized)
    return records


def wide_group_record(
    source_file: str,
    source_sheet: str,
    company: str,
    industry: str = "",
    followers: str = "",
    profile_link: str = "",
    address: str = "",
    *misc_values: str,
) -> dict[str, str] | None:
    record = record_template(source_file, source_sheet)
    record["Company Name"] = clean_text(company)
    record["Industry"] = clean_text(industry)
    record["Followers"] = clean_text(followers)
    record["Address"] = clean_text(address)
    classify_profile_link(record, clean_text(profile_link))
    add_misc_contact_data(record, *misc_values)
    return finalize_record(record)


def extract_clients_to_pitch(path: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []

    high_end = pd.read_excel(path, sheet_name="High-End Accounts")
    high_end_groups = [
        ("High-End Accounts (Hospitality)", "Current Followers", "Profile Link", "Address", "Hospitality"),
        ("High-End Accounts (Real-Estate)", "Current Followers.1", "Profile Link.1", "Address.1", "Real Estate"),
        ("Low-End Accounts (Jewellry)", "Current Followers.2", "Profile Link.2", "Address.2", "Jewellery"),
    ]
    for _, row in high_end.iterrows():
        for company_col, followers_col, profile_col, address_col, industry in high_end_groups:
            record = wide_group_record(
                path.name,
                "High-End Accounts",
                row.get(company_col),
                industry,
                row.get(followers_col),
                row.get(profile_col),
                row.get(address_col),
            )
            if record:
                records.append(record)

    low_end = pd.read_excel(path, sheet_name="Low-End Accounts")
    for _, row in low_end.iterrows():
        fnb_record = wide_group_record(
            path.name,
            "Low-End Accounts",
            row.get("Low-End Accounts (F&B)"),
            "F&B",
            row.get("Current Followers"),
            row.get("Profile Link"),
            row.get("Address"),
            row.get("LinkedIn Link"),
            row.get("Contact Info"),
            row.get("Owner"),
        )
        if fnb_record:
            records.append(fnb_record)

        jewellery_record = wide_group_record(
            path.name,
            "Low-End Accounts",
            row.get("Low-End Accounts (Jewellry)"),
            "Jewellery",
            row.get("Current Followers.1"),
            row.get("Profile Link.1"),
            row.get("Address.1"),
        )
        if jewellery_record:
            records.append(jewellery_record)

        generic_record = wide_group_record(
            path.name,
            "Low-End Accounts",
            row.get("Low-End Accounts"),
            row.get("Industry"),
            row.get("Current Followers.2"),
            row.get("Profile Link.2"),
            row.get("Address.2"),
        )
        if generic_record:
            records.append(generic_record)

        apparel_record = wide_group_record(
            path.name,
            "Low-End Accounts",
            row.get("Apparels"),
            "Apparels",
        )
        if apparel_record:
            records.append(apparel_record)

    shivanya = pd.read_excel(path, sheet_name="Shivanya Sheet")
    for _, row in shivanya.iterrows():
        record = wide_group_record(
            path.name,
            "Shivanya Sheet",
            row.get("Accounts "),
            row.get("Industry"),
            row.get("Current Followers"),
            row.get("Profile Link"),
            row.get("Address"),
            row.get("LinkedIn Link"),
            row.get("Contact Info"),
            row.get("Owner"),
        )
        if record:
            records.append(record)

    delivery = pd.read_excel(path, sheet_name="Delivery Sheet")
    for _, row in delivery.iterrows():
        record = wide_group_record(
            path.name,
            "Delivery Sheet",
            row.get("Low-End Accounts (F&B)"),
            "F&B",
            row.get("Current Followers"),
            row.get("Profile Link"),
            row.get("To: Address"),
            row.get("To: Contact Info"),
            row.get("LinkedIn/Insta"),
            row.get("Confirm Contact info"),
        )
        if record:
            add_channel_data(record, row.get("Remarks 1"))
            notes = unique_join(
                [
                    record["Notes"],
                    single_line(row.get("Remarks 1")),
                    single_line(row.get("Delivery Status")),
                    single_line(row.get("Follow-up 1")),
                    single_line(row.get("Package Number")),
                    single_line(row.get("Loopholes")),
                ]
            )
            record["Notes"] = notes
            records.append(finalize_record(record) or record)

    pema = pd.read_excel(path, sheet_name="Pema sheet ")
    for _, row in pema.iterrows():
        record = wide_group_record(
            path.name,
            "Pema sheet",
            row.get(" Accounts (F&B)"),
            "F&B",
            row.get("Current Followers"),
            row.get("Profile Link"),
            row.get("To: Address"),
            row.get("To: Contact Info"),
            row.get("LinkedIn/Insta"),
            row.get("From: Contact Info"),
        )
        if record:
            add_channel_data(record, row.get("Remarks 1"))
            record["Notes"] = unique_join([record["Notes"], single_line(row.get("Remarks 1"))])
            records.append(record)

    return records


def build_company_enrichment(records: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    enrichment: dict[str, dict[str, str]] = {}
    for record in records:
        company_key = normalize_key(record["Company Name"])
        if not company_key:
            continue
        bucket = enrichment.setdefault(
            company_key,
            {
                "Industry": "",
                "Website": "",
                "Instagram": "",
                "Address": "",
                "City": "",
                "State": "",
                "Country": "",
            },
        )
        for field in ("Industry", "Website", "Instagram"):
            bucket[field] = merge_unique(bucket[field], record[field])
        for field in ("Address", "City", "State", "Country"):
            bucket[field] = choose_richer(bucket[field], record[field])
    return enrichment


def add_company_backfill(records: list[dict[str, str]], enrichment: dict[str, dict[str, str]]) -> None:
    for record in records:
        company_key = normalize_key(record["Company Name"])
        if not company_key or company_key not in enrichment:
            continue
        bucket = enrichment[company_key]
        for field in ("Industry", "Website", "Instagram"):
            if not record[field]:
                record[field] = bucket[field]
        for field in ("Address", "City", "State", "Country"):
            if not record[field]:
                record[field] = bucket[field]
        record["Data Completeness Score"] = str(
            sum(
                1
                for field in FINAL_COLUMNS
                if field not in {"Source File", "Source Sheet", "Notes", "Data Completeness Score"}
                and record[field]
            )
        )


def merge_records(left: dict[str, str], right: dict[str, str]) -> dict[str, str]:
    merged = left.copy()
    merged["Person Name"] = choose_richer(merged["Person Name"], right["Person Name"])
    merged["Company Name"] = choose_richer(merged["Company Name"], right["Company Name"])
    merged["Address"] = choose_richer(merged["Address"], right["Address"])
    merged["City"] = choose_richer(merged["City"], right["City"])
    merged["State"] = choose_richer(merged["State"], right["State"])
    merged["Country"] = choose_richer(merged["Country"], right["Country"])
    merged["Contact"] = merge_unique(merged["Contact"], right["Contact"])
    merged["Designation"] = merge_unique(merged["Designation"], right["Designation"])
    merged["Industry"] = merge_unique(merged["Industry"], right["Industry"])
    merged["Email"] = merge_unique(merged["Email"], right["Email"])
    merged["Phone"] = merge_phones(merged["Phone"], right["Phone"])
    merged["LinkedIn"] = merge_unique(merged["LinkedIn"], right["LinkedIn"])
    merged["Website"] = merge_unique(merged["Website"], right["Website"])
    merged["Instagram"] = merge_unique(merged["Instagram"], right["Instagram"])
    merged["Followers"] = merge_unique(merged["Followers"], right["Followers"])
    merged["Employee Size"] = merge_unique(merged["Employee Size"], right["Employee Size"])
    merged["Source File"] = merge_unique(merged["Source File"], right["Source File"])
    merged["Source Sheet"] = merge_unique(merged["Source Sheet"], right["Source Sheet"])
    merged["Notes"] = merge_unique(merged["Notes"], right["Notes"])
    merged["Data Completeness Score"] = str(
        max(int(merged["Data Completeness Score"] or "0"), int(right["Data Completeness Score"] or "0"))
    )
    return merged


def record_tokens(record: dict[str, str]) -> list[str]:
    tokens: list[str] = []
    company_key = normalize_key(record["Company Name"])
    person_key = normalize_key(record["Person Name"])

    if record["Email"]:
        for email in record["Email"].split(" | "):
            tokens.append(f"email:{email.lower()}")
    if record["LinkedIn"]:
        for linkedin in record["LinkedIn"].split(" | "):
            tokens.append(f"linkedin:{normalize_key(linkedin)}")
    if company_key and person_key:
        tokens.append(f"company_person:{company_key}|{person_key}")
    if company_key and record["Phone"]:
        for phone in record["Phone"].split(" | "):
            tokens.append(f"company_phone:{company_key}|{normalize_phone(phone)}")
    if company_key and not any(record[field] for field in ("Person Name", "Email", "Phone", "LinkedIn", "Contact")):
        tokens.append(f"company_only:{company_key}")
    return list(dict.fromkeys(token for token in tokens if token))


def smart_merge(records: list[dict[str, str]]) -> list[dict[str, str]]:
    if not records:
        return []
    dsu = DisjointSet(len(records))
    seen_tokens: dict[str, int] = {}

    for index, record in enumerate(records):
        for token in record_tokens(record):
            existing = seen_tokens.get(token)
            if existing is None:
                seen_tokens[token] = index
            else:
                dsu.union(existing, index)

    grouped: dict[int, list[dict[str, str]]] = defaultdict(list)
    for index, record in enumerate(records):
        grouped[dsu.find(index)].append(record)

    merged_rows: list[dict[str, str]] = []
    for group in grouped.values():
        combined = group[0]
        for candidate in group[1:]:
            combined = merge_records(combined, candidate)
        combined["Data Completeness Score"] = str(
            sum(
                1
                for field in FINAL_COLUMNS
                if field not in {"Source File", "Source Sheet", "Notes", "Data Completeness Score"}
                and combined[field]
            )
        )
        merged_rows.append(combined)

    merged_rows.sort(
        key=lambda row: (
            -int(row["Data Completeness Score"] or "0"),
            normalize_key(row["Company Name"]),
            normalize_key(row["Person Name"]),
        )
    )
    return merged_rows


def prune_company_only_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    passthrough: list[dict[str, str]] = []

    for row in rows:
        company_key = normalize_key(row["Company Name"])
        if not company_key:
            passthrough.append(row)
            continue
        grouped[company_key].append(row)

    pruned: list[dict[str, str]] = []
    for group in grouped.values():
        has_contact_row = any(
            any(row[field] for field in ("Person Name", "Email", "Phone", "LinkedIn", "Contact"))
            for row in group
        )
        if not has_contact_row:
            pruned.extend(group)
            continue
        for row in group:
            is_company_only = not any(row[field] for field in ("Person Name", "Email", "Phone", "LinkedIn", "Contact"))
            if not is_company_only:
                pruned.append(row)
    pruned.extend(passthrough)
    pruned.sort(
        key=lambda row: (
            -int(row["Data Completeness Score"] or "0"),
            normalize_key(row["Company Name"]),
            normalize_key(row["Person Name"]),
        )
    )
    return pruned


def collect_records(input_dir: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    extractors = {
        SOURCE_FILES[0]: extract_bangalore_it,
        SOURCE_FILES[1]: extract_clients_to_pitch,
        SOURCE_FILES[2]: extract_it_email_linkedin,
        SOURCE_FILES[3]: extract_it_companies_combined,
        SOURCE_FILES[4]: extract_scrapped,
    }
    for file_name, extractor in extractors.items():
        path = input_dir / file_name
        if not path.exists():
            continue
        records.extend(extractor(path))
    return records


def split_multi_values(series: pd.Series) -> pd.Series:
    exploded = (
        series.fillna("")
        .astype(str)
        .str.split(r"\s+\|\s+", regex=True)
        .explode()
        .map(clean_text)
    )
    return exploded[exploded != ""]


def build_summary_tables(raw_rows: int, merged_rows: list[dict[str, str]]) -> tuple[list[tuple[str, pd.DataFrame]], pd.DataFrame]:
    master = pd.DataFrame(merged_rows, columns=FINAL_COLUMNS)
    summary_sections: list[tuple[str, pd.DataFrame]] = []

    metrics = pd.DataFrame(
        [
            {"Metric": "Extracted source rows", "Value": raw_rows},
            {"Metric": "Unified lead rows", "Value": len(master)},
            {"Metric": "Unique companies", "Value": master["Company Name"].fillna("").astype(str).str.strip().replace("", pd.NA).dropna().nunique()},
            {"Metric": "Rows with person name", "Value": (master["Person Name"] != "").sum()},
            {"Metric": "Rows with email", "Value": (master["Email"] != "").sum()},
            {"Metric": "Rows with phone", "Value": (master["Phone"] != "").sum()},
            {"Metric": "Rows with LinkedIn", "Value": (master["LinkedIn"] != "").sum()},
            {"Metric": "Rows with industry", "Value": (master["Industry"] != "").sum()},
            {"Metric": "Rows with website", "Value": (master["Website"] != "").sum()},
            {"Metric": "Rows with address", "Value": (master["Address"] != "").sum()},
            {"Metric": "Rows merged or removed", "Value": max(raw_rows - len(master), 0)},
        ]
    )
    summary_sections.append(("Metrics", metrics))

    industry_counts = split_multi_values(master["Industry"]).value_counts().rename_axis("Industry").reset_index(name="Lead Count")
    source_file_counts = split_multi_values(master["Source File"]).value_counts().rename_axis("Source File").reset_index(name="Lead Count")
    source_sheet_counts = split_multi_values(master["Source Sheet"]).value_counts().rename_axis("Source Sheet").reset_index(name="Lead Count")
    score_counts = master["Data Completeness Score"].value_counts().sort_index(ascending=False).rename_axis("Completeness Score").reset_index(name="Lead Count")

    summary_sections.append(("By Industry", industry_counts))
    summary_sections.append(("By Source File", source_file_counts))
    summary_sections.append(("By Source Sheet", source_sheet_counts))
    summary_sections.append(("By Completeness Score", score_counts))

    flat_frames: list[pd.DataFrame] = []
    for section_name, frame in summary_sections:
        current = frame.copy()
        current.insert(0, "Section", section_name)
        flat_frames.append(current)
    summary_csv = pd.concat(flat_frames, ignore_index=True)
    return summary_sections, summary_csv


def auto_fit_sheet(worksheet, frame: pd.DataFrame) -> None:
    for idx, column in enumerate(frame.columns):
        max_width = max(
            [len(str(column))]
            + [len(str(value)) for value in frame[column].fillna("").astype(str).head(1000)]
        )
        worksheet.set_column(idx, idx, min(max_width + 2, 50))


def write_outputs(output_xlsx: Path, output_csv: Path, summary_csv_path: Path, merged_rows: list[dict[str, str]], summary_sections: list[tuple[str, pd.DataFrame]], summary_csv: pd.DataFrame) -> None:
    master = pd.DataFrame(merged_rows, columns=FINAL_COLUMNS)
    master.to_csv(output_csv, index=False, encoding="utf-8-sig")
    summary_csv.to_csv(summary_csv_path, index=False, encoding="utf-8-sig")

    with pd.ExcelWriter(output_xlsx, engine="xlsxwriter") as writer:
        master.to_excel(writer, sheet_name="Master Leads", index=False)
        workbook = writer.book
        master_sheet = writer.sheets["Master Leads"]
        header_format = workbook.add_format({"bold": True, "bg_color": "#D9EAF7", "border": 1})
        section_format = workbook.add_format({"bold": True, "bg_color": "#E2F0D9"})

        for col_idx, column in enumerate(master.columns):
            master_sheet.write(0, col_idx, column, header_format)
        master_sheet.freeze_panes(1, 0)
        master_sheet.autofilter(0, 0, len(master), len(master.columns) - 1)
        auto_fit_sheet(master_sheet, master)

        summary_sheet = workbook.add_worksheet("Summary")
        writer.sheets["Summary"] = summary_sheet
        row_pointer = 0
        for section_name, frame in summary_sections:
            summary_sheet.write(row_pointer, 0, section_name, section_format)
            frame.to_excel(writer, sheet_name="Summary", index=False, startrow=row_pointer + 1, startcol=0)
            for col_idx, column in enumerate(frame.columns):
                summary_sheet.write(row_pointer + 1, col_idx, column, header_format)
            auto_fit_sheet(summary_sheet, frame)
            row_pointer += len(frame) + 4


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Unify messy lead workbooks into one clean master list.")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path(r"C:\Users\Win 10\Akash Leads"),
        help="Directory containing the source Excel files.",
    )
    parser.add_argument(
        "--output-prefix",
        default="Unified_Lead_List",
        help="Base file name used for the output files.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_dir = args.input_dir
    output_xlsx = input_dir / f"{args.output_prefix}.xlsx"
    output_csv = input_dir / f"{args.output_prefix}.csv"
    summary_csv_path = input_dir / f"{args.output_prefix}_Summary.csv"

    raw_records = collect_records(input_dir)
    company_enrichment = build_company_enrichment(raw_records)
    add_company_backfill(raw_records, company_enrichment)
    merged_rows = smart_merge(raw_records)
    merged_rows = prune_company_only_rows(merged_rows)
    summary_sections, summary_csv = build_summary_tables(len(raw_records), merged_rows)
    write_outputs(output_xlsx, output_csv, summary_csv_path, merged_rows, summary_sections, summary_csv)

    print(f"Raw records extracted: {len(raw_records)}")
    print(f"Unified lead rows: {len(merged_rows)}")
    print(f"Excel output: {output_xlsx}")
    print(f"CSV output: {output_csv}")
    print(f"Summary CSV: {summary_csv_path}")


if __name__ == "__main__":
    main()
