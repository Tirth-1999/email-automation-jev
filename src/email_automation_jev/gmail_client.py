from __future__ import annotations

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Protocol, TypeVar

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import Resource, build

from .config import OAuthConfig

T = TypeVar("T")
GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


class RequestRunner(Protocol):
    def run(self, operation: str, request: Any) -> Any: ...


class DirectRequestRunner:
    def run(self, _operation: str, request: Any) -> Any:
        return request()


def create_gmail_client(oauth: OAuthConfig, refresh_token: str) -> Resource:
    credentials = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=oauth.client_id,
        client_secret=oauth.client_secret,
        scopes=[GMAIL_READONLY_SCOPE],
    )
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def get_gmail_profile(gmail: Resource, requests: RequestRunner | None = None) -> dict[str, Any]:
    runner = requests or DirectRequestRunner()
    data = runner.run("users.getProfile", lambda: gmail.users().getProfile(userId="me").execute())
    if not data.get("emailAddress") or not data.get("historyId"):
        raise ValueError("Gmail profile did not include emailAddress and historyId")
    return {
        "email_address": data["emailAddress"].lower(),
        "history_id": data["historyId"],
        "messages_total": data.get("messagesTotal"),
    }


def list_full_sync_message_pages(
    gmail: Resource,
    *,
    query: str,
    include_spam_trash: bool,
    max_messages: int,
    requests: RequestRunner | None = None,
) -> Iterator[list[str]]:
    runner = requests or DirectRequestRunner()
    page_token: str | None = None
    remaining = max_messages or float("inf")
    while True:
        kwargs: dict[str, Any] = {
            "userId": "me",
            "includeSpamTrash": include_spam_trash,
            "maxResults": min(500, int(remaining)) if remaining != float("inf") else 500,
        }
        if query:
            kwargs["q"] = query
        if page_token:
            kwargs["pageToken"] = page_token
        response = runner.run(
            "users.messages.list",
            lambda kwargs=kwargs: gmail.users().messages().list(**kwargs).execute(),
        )
        ids = [message["id"] for message in response.get("messages", []) if message.get("id")]
        if remaining != float("inf"):
            ids = ids[: int(remaining)]
        if ids:
            yield ids
        remaining -= len(ids)
        page_token = response.get("nextPageToken")
        if not page_token or remaining <= 0:
            return


def list_incremental_changes(
    gmail: Resource,
    start_history_id: str,
    requests: RequestRunner | None = None,
) -> dict[str, Any]:
    runner = requests or DirectRequestRunner()
    changed: set[str] = set()
    deleted: set[str] = set()
    page_token: str | None = None
    next_history_id = start_history_id
    while True:
        kwargs: dict[str, Any] = {
            "userId": "me",
            "startHistoryId": start_history_id,
            "maxResults": 500,
        }
        if page_token:
            kwargs["pageToken"] = page_token
        response = runner.run(
            "users.history.list",
            lambda kwargs=kwargs: gmail.users().history().list(**kwargs).execute(),
        )
        for entry in response.get("history", []):
            for key in ("messagesAdded", "labelsAdded", "labelsRemoved"):
                for item in entry.get(key, []):
                    if message_id := (item.get("message") or {}).get("id"):
                        changed.add(message_id)
            for item in entry.get("messagesDeleted", []):
                if message_id := (item.get("message") or {}).get("id"):
                    deleted.add(message_id)
        next_history_id = response.get("historyId", next_history_id)
        page_token = response.get("nextPageToken")
        if not page_token:
            break
    changed -= deleted
    return {
        "changed_message_ids": list(changed),
        "deleted_message_ids": list(deleted),
        "next_history_id": next_history_id,
    }


def fetch_messages(
    gmail: Resource,
    ids: list[str],
    concurrency: int,
    requests: RequestRunner | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    runner = requests or DirectRequestRunner()

    def fetch(message_id: str) -> tuple[str, dict[str, Any] | None]:
        try:
            message = runner.run(
                "users.messages.get",
                lambda: gmail.users().messages().get(userId="me", id=message_id, format="full").execute(),
            )
            return message_id, message
        except BaseException as error:
            if is_not_found_error(error):
                return message_id, None
            raise

    by_id: dict[str, dict[str, Any]] = {}
    missing: list[str] = []
    with ThreadPoolExecutor(max_workers=min(concurrency, max(1, len(ids)))) as executor:
        futures = [executor.submit(fetch, message_id) for message_id in ids]
        for future in as_completed(futures):
            message_id, message = future.result()
            if message is None:
                missing.append(message_id)
            else:
                by_id[message_id] = message
    return [by_id[message_id] for message_id in ids if message_id in by_id], missing


def is_not_found_error(error: BaseException) -> bool:
    response = getattr(error, "resp", None)
    return getattr(error, "status_code", None) == 404 or getattr(response, "status", None) == 404


is_expired_history_error = is_not_found_error
