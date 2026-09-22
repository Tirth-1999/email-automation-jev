from email_automation_jev.gmail_client import list_full_sync_message_pages, list_incremental_changes


class Request:
    def __init__(self, value: dict) -> None:
        self.value = value

    def execute(self) -> dict:
        return self.value


class Messages:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def list(self, **kwargs: object) -> Request:
        self.calls.append(kwargs)
        if "pageToken" not in kwargs:
            return Request({"messages": [{"id": "one"}, {"id": "two"}], "nextPageToken": "next"})
        return Request({"messages": [{"id": "three"}, {"id": "four"}]})


class History:
    def __init__(self) -> None:
        self.page = 0

    def list(self, **_kwargs: object) -> Request:
        self.page += 1
        if self.page == 1:
            return Request(
                {
                    "history": [{"messagesAdded": [{"message": {"id": "new"}}], "labelsAdded": [{"message": {"id": "relabeled"}}]}],
                    "historyId": "101",
                    "nextPageToken": "next",
                }
            )
        return Request(
            {"history": [{"messagesAdded": [{"message": {"id": "new"}}], "messagesDeleted": [{"message": {"id": "relabeled"}}]}], "historyId": "102"}
        )


class Users:
    def __init__(self) -> None:
        self.message_api, self.history_api = Messages(), History()

    def messages(self) -> Messages:
        return self.message_api

    def history(self) -> History:
        return self.history_api


class Gmail:
    def __init__(self) -> None:
        self.user_api = Users()

    def users(self) -> Users:
        return self.user_api


def test_full_sync_paginates_and_respects_limit() -> None:
    gmail = Gmail()
    pages = list(list_full_sync_message_pages(gmail, query="-in:drafts", include_spam_trash=False, max_messages=3))
    assert pages == [["one", "two"], ["three"]]
    assert gmail.user_api.message_api.calls[1]["pageToken"] == "next"


def test_zero_limit_means_all_messages() -> None:
    gmail = Gmail()
    pages = list(list_full_sync_message_pages(gmail, query="", include_spam_trash=True, max_messages=0))
    assert [message_id for page in pages for message_id in page] == ["one", "two", "three", "four"]


def test_incremental_changes_deduplicate_and_deletion_wins() -> None:
    result = list_incremental_changes(Gmail(), "100")
    assert result["changed_message_ids"] == ["new"]
    assert result["deleted_message_ids"] == ["relabeled"]
    assert result["next_history_id"] == "102"
