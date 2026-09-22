from email_automation_jev.classification_bootstrap import human_dataset_version, human_label_import_rows
from email_automation_jev.classification_repository import sanitized_classification_error
from email_automation_jev.jev_classifier import CLASSIFIER_QUESTIONS, CLASSIFIER_VERSION, build_email_state


def test_classifier_version_and_four_judgments_are_stable() -> None:
    assert CLASSIFIER_VERSION == "job-email-jev-v4"
    assert set(CLASSIFIER_QUESTIONS) == {"category", "action", "urgency", "draft_reply"}


def test_email_state_truncates_body() -> None:
    state = build_email_state(
        {
            "direction": "incoming",
            "from_name": None,
            "from_email": "a@b.com",
            "to_recipients": [],
            "subject": "Role",
            "snippet": "Next",
            "body_text": "x" * 25000,
        }
    )
    assert len(state["body"]) == 20000


def test_human_dataset_hash_is_order_independent() -> None:
    rows = [{"email_id": "a", "manual_label": "applied", "labeled_at": "1"}, {"email_id": "b", "manual_label": "offer", "labeled_at": "2"}]
    assert human_dataset_version(rows) == human_dataset_version(list(reversed(rows)))


def test_human_label_import_is_idempotently_keyed() -> None:
    row = {"email_id": "a", "manual_label": "applied", "labeled_at": "1", "review_notes": "yes"}
    result = human_label_import_rows([row])[0]
    assert result["source_key"] == "initial-json:a:1"
    assert result["source"] == "review_ui"


def test_classification_errors_redact_secrets() -> None:
    value = sanitized_classification_error(RuntimeError("Bearer abc api_key=secret password=hunter2"))
    assert "abc" not in value and "secret" not in value and "hunter2" not in value
