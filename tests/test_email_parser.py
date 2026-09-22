import base64

from email_automation_jev.email_parser import decode_base64url, normalize_gmail_message, parse_address_list


def encode(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")


def test_decodes_gmail_base64url() -> None:
    assert decode_base64url(encode("Hello + résumé")) == "Hello + résumé"


def test_parses_named_and_plain_addresses() -> None:
    assert parse_address_list("Recruiter Person <Recruiter@Example.com>, jobs@example.org") == [
        {"name": "Recruiter Person", "email": "recruiter@example.com", "raw": "Recruiter Person <Recruiter@Example.com>"},
        {"name": None, "email": "jobs@example.org", "raw": "jobs@example.org"},
    ]


def test_normalizes_multipart_and_attachment() -> None:
    message = {
        "id": "m1",
        "threadId": "t1",
        "historyId": "12",
        "internalDate": "1760000000000",
        "labelIds": ["INBOX"],
        "snippet": "Thanks",
        "payload": {
            "mimeType": "multipart/mixed",
            "headers": [
                {"name": "From", "value": "Acme <jobs@acme.com>"},
                {"name": "To", "value": "candidate@gmail.com"},
                {"name": "Subject", "value": "Application received"},
            ],
            "parts": [
                {"mimeType": "text/plain", "body": {"data": encode("Thanks for applying.")}},
                {"mimeType": "application/pdf", "filename": "role.pdf", "body": {"attachmentId": "a1", "size": 42}},
            ],
        },
    }
    result = normalize_gmail_message(message, "candidate@gmail.com")
    assert result["from_email"] == "jobs@acme.com"
    assert result["direction"] == "incoming"
    assert result["body_text"] == "Thanks for applying."
    assert result["attachment_metadata"][0]["filename"] == "role.pdf"


def test_html_only_body_becomes_clean_text() -> None:
    message = {
        "id": "m2",
        "threadId": "t2",
        "internalDate": "1760000000000",
        "payload": {
            "mimeType": "text/html",
            "headers": [{"name": "From", "value": "jobs@example.com"}],
            "body": {"data": encode("<p>Schedule your <strong>interview</strong>.</p>")},
        },
    }
    assert normalize_gmail_message(message, "candidate@gmail.com")["body_text"] == "Schedule your interview."
