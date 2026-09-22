import pytest

from email_automation_jev.gmail_rate_limit import GmailRequestController, is_retryable_gmail_error


class HttpError(Exception):
    def __init__(self, status: int, content: str = "") -> None:
        self.status_code = status
        self.content = content.encode()
        super().__init__(content)


@pytest.mark.parametrize("status", [429, 500, 503, 504])
def test_transient_status_is_retryable(status: int) -> None:
    assert is_retryable_gmail_error(HttpError(status))


def test_quota_403_is_retryable_but_policy_is_not() -> None:
    assert is_retryable_gmail_error(HttpError(403, "userRateLimitExceeded Quota exceeded"))
    assert not is_retryable_gmail_error(HttpError(403, "domainPolicy"))


def test_retries_with_exponential_backoff() -> None:
    clock = [0.0]
    sleeps: list[float] = []
    attempts: list[int] = []
    calls = [0]

    def sleep(seconds: float) -> None:
        sleeps.append(seconds)
        clock[0] += seconds

    controller = GmailRequestController(
        1000, 3, base_delay_seconds=1, random_value=lambda: 0, now=lambda: clock[0], sleep=sleep, on_retry=lambda notice: attempts.append(notice.attempt)
    )

    def request() -> str:
        calls[0] += 1
        if calls[0] < 3:
            raise HttpError(403, "userRateLimitExceeded")
        return "ok"

    assert controller.run("get", request) == "ok"
    assert attempts == [1, 2]
    assert sleeps == [1, 2]


def test_paces_successful_requests() -> None:
    clock = [0.0]
    sleeps: list[float] = []

    def sleep(seconds: float) -> None:
        sleeps.append(seconds)
        clock[0] += seconds

    controller = GmailRequestController(4, 0, now=lambda: clock[0], sleep=sleep)
    controller.run("one", lambda: "one")
    controller.run("two", lambda: "two")
    assert sleeps == [0.25]
