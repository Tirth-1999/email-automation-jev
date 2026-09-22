import pytest

from email_automation_jev.labeling_sample import is_atc_email, select_additional_sample, select_labeling_sample


def email(index: int, *, subject: str = "Hello", direction: str = "incoming") -> dict:
    return {
        "id": str(index),
        "gmail_message_id": f"m{index}",
        "gmail_thread_id": f"t{index}",
        "internal_date": "2026-01-01T00:00:00Z",
        "direction": direction,
        "from_name": None,
        "from_email": f"sender{index}@example.com",
        "to_recipients": [],
        "subject": subject,
        "snippet": subject,
        "body_text": subject,
        "label_ids": [],
    }


def test_atc_detection_and_required_selection() -> None:
    rows = [email(i) for i in range(20)]
    rows[7]["from_email"] = "recruiter@atc.com"
    assert is_atc_email(rows[7])
    sample = select_labeling_sample(rows, 5, "seed")
    assert any(row["id"] == "7" and row["selection_reason"] == "atc_required" for row in sample)


def test_initial_sample_is_deterministic_and_unique() -> None:
    rows = [email(i) for i in range(100)]
    one = select_labeling_sample(rows, 20, "seed")
    two = select_labeling_sample(rows, 20, "seed")
    assert [row["id"] for row in one] == [row["id"] for row in two]
    assert len({row["id"] for row in one}) == 20


def test_additional_sample_excludes_reviewed_and_favors_discovery() -> None:
    rows = [email(i, subject="Interview next steps" if i < 30 else "Newsletter") for i in range(100)]
    selected = select_additional_sample(rows, {"0", "1"}, 20, "more", "balanced")
    assert not ({row["id"] for row in selected} & {"0", "1"})
    assert sum("Interview" in row["subject"] for row in selected) >= 14


def test_additional_sample_fails_when_too_few_remain() -> None:
    with pytest.raises(ValueError):
        select_additional_sample([email(1)], {"1"}, 1, "seed", "random")
