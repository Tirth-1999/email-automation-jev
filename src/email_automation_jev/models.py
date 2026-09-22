from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, TypedDict

Direction = Literal["incoming", "outgoing", "unknown"]
SyncType = Literal["full", "incremental", "recovery_full"]
JevCategory = Literal[
    "applied",
    "outreach",
    "reply_needed",
    "interview_assessment",
    "offer",
    "rejected",
    "other",
]
ClassificationDecision = JevCategory | Literal["uncertain"]
ActionType = Literal[
    "no_action",
    "write_reply",
    "open_link",
    "fill_form",
    "schedule_interview",
    "complete_assessment",
    "send_document",
    "review_offer",
]


class AddressValue(TypedDict):
    name: str | None
    email: str | None
    raw: str


class AttachmentMetadata(TypedDict):
    filename: str
    mimeType: str
    attachmentId: str | None
    size: int | None


class NormalizedEmail(TypedDict):
    gmail_message_id: str
    gmail_thread_id: str
    rfc_message_id: str | None
    gmail_history_id: str | None
    internal_date: str
    direction: Direction
    from_name: str | None
    from_email: str | None
    to_recipients: list[AddressValue]
    cc_recipients: list[AddressValue]
    subject: str
    snippet: str
    body_text: str
    body_html: str
    label_ids: list[str]
    attachment_metadata: list[AttachmentMetadata]
    raw_headers: dict[str, str]
    size_estimate: int | None
    deleted_at: None


@dataclass
class SyncCounts:
    discovered: int = 0
    inserted: int = 0
    updated: int = 0
    deleted: int = 0
    skipped: int = 0


@dataclass
class GmailAccount:
    id: str
    gmail_address: str
    latest_history_id: str | None


@dataclass
class IngestionStats:
    stage: str = "starting"
    page: int = 0
    iteration: int = 0
    discovered: int = 0
    existing: int = 0
    pending: int = 0
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    deleted: int = 0


@dataclass
class IngestionResult:
    sync_type: SyncType
    counts: SyncCounts
    history_id: str


@dataclass
class JevClassification:
    classifier_version: str
    category: JevCategory
    decision: ClassificationDecision
    confidence: float
    top_probability: float
    probabilities: dict[str, float]
    action: dict[str, Any]
    urgency: dict[str, Any]
    draft_reply: dict[str, Any]
    model: str
    input_tokens: int


JsonObject = dict[str, Any]
