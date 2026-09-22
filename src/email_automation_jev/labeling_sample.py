from __future__ import annotations

import re
from typing import Literal, TypedDict, cast

from .models import AddressValue, Direction
from .reservoir_sample import add_to_reservoir, create_seeded_random, shuffle_in_place


class LabelingEmail(TypedDict):
    id: str
    gmail_message_id: str
    gmail_thread_id: str
    internal_date: str
    direction: Direction
    from_name: str | None
    from_email: str | None
    to_recipients: list[AddressValue]
    subject: str
    snippet: str
    body_text: str
    label_ids: list[str]


class SampledLabelingEmail(LabelingEmail):
    """A labeling email annotated with why it entered the review sample."""

    selection_reason: str


LABEL_CATEGORIES = (
    "applied",
    "outreach",
    "reply_needed",
    "interview_assessment",
    "offer",
    "rejected",
    "other",
    "uncertain",
)
ATC_PATTERN = re.compile(r"(^|[^a-z0-9])atc([^a-z0-9]|$)", re.I)
DISCOVERY_PATTERN = re.compile(
    r"\b(reply|respond|response|action required|action needed|next steps?|"
    r"additional (questions?|information)|right to represent|representation|"
    r"send (me )?(your )?(updated )?resume|interview|screening|schedule|meeting|"
    r"call|assessment|test|case study|challenge|exercise|puzzle|offer|decision|"
    r"rejected|not moving forward)\b",
    re.I,
)


def is_atc_email(email: LabelingEmail) -> bool:
    values: list[str | None] = [email["from_name"], email["from_email"], email["subject"]]
    for recipient in email["to_recipients"]:
        values.extend([recipient.get("name"), recipient.get("email"), recipient.get("raw")])
    return any(value is not None and ATC_PATTERN.search(value) for value in values)


def _reservoir(values: list[LabelingEmail], count: int, seed: str) -> list[LabelingEmail]:
    rng = create_seeded_random(seed)
    result: list[LabelingEmail] = []
    for index, value in enumerate(values, 1):
        add_to_reservoir(result, value, index, count, rng)
    shuffle_in_place(result, rng)
    return result


def select_labeling_sample(emails: list[LabelingEmail], sample_size: int, seed: str) -> list[SampledLabelingEmail]:
    required = [email for email in emails if is_atc_email(email)]
    if len(required) > sample_size:
        raise ValueError(f"{len(required)} ATC emails exceed the requested {sample_size}-email review size")
    rng = create_seeded_random(seed)
    candidates = [email for email in emails if not is_atc_email(email)]
    selected = [cast(SampledLabelingEmail, {**email, "selection_reason": "atc_required"}) for email in required] + [
        cast(SampledLabelingEmail, {**email, "selection_reason": "random"})
        for email in _reservoir(candidates, sample_size - len(required), seed)
    ]
    shuffle_in_place(selected, rng)
    return selected


def select_additional_sample(
    emails: list[LabelingEmail],
    excluded_ids: set[str],
    count: int,
    seed: str,
    strategy: Literal["balanced", "random"],
) -> list[LabelingEmail]:
    candidates = [email for email in emails if email["id"] not in excluded_ids]
    if len(candidates) < count:
        raise ValueError(f"Only {len(candidates)} unseen emails remain; cannot add {count}")
    if strategy == "random":
        return _reservoir(candidates, count, seed)
    priority = [email for email in candidates if email["direction"] == "outgoing" or DISCOVERY_PATTERN.search(f"{email['subject']}\n{email['snippet']}")]
    target = min(len(priority), (count * 7 + 9) // 10)
    selected_priority = _reservoir(priority, target, f"{seed}:priority")
    selected_ids = {email["id"] for email in selected_priority}
    remaining = [email for email in candidates if email["id"] not in selected_ids]
    return selected_priority + _reservoir(remaining, count - len(selected_priority), f"{seed}:remainder")
