from __future__ import annotations

import random
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class GmailRetryNotice:
    operation: str
    attempt: int
    max_retries: int
    delay_seconds: float
    reason: str


def _error_details(error: BaseException) -> tuple[int | None, list[str], str]:
    status = getattr(error, "status_code", None) or getattr(error, "status", None)
    response = getattr(error, "resp", None)
    if response is not None:
        status = getattr(response, "status", status)
    content = getattr(error, "content", b"")
    message = str(error)
    reasons: list[str] = []
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="replace")
    if isinstance(content, str) and content:
        message = content
        for reason in ("rateLimitExceeded", "userRateLimitExceeded", "backendError"):
            if reason in content:
                reasons.append(reason)
    try:
        numeric_status = int(status) if status is not None else None
    except (TypeError, ValueError):
        numeric_status = None
    return numeric_status, reasons, message


def is_retryable_gmail_error(error: BaseException) -> bool:
    status, reasons, message = _error_details(error)
    if status == 429 or (status is not None and 500 <= status <= 504):
        return True
    if status != 403:
        return False
    if set(reasons) & {"rateLimitExceeded", "userRateLimitExceeded", "backendError"}:
        return True
    lowered = message.lower()
    return "quota exceeded" in lowered or "rate limit" in lowered or "user-rate limit" in lowered


class GmailRequestController:
    """Serializes request starts and retries transient Gmail quota failures."""

    def __init__(
        self,
        requests_per_second: float,
        max_retries: int,
        *,
        base_delay_seconds: float = 1,
        max_delay_seconds: float = 60,
        on_retry: Callable[[GmailRetryNotice], None] | None = None,
        sleep: Callable[[float], None] = time.sleep,
        now: Callable[[], float] = time.monotonic,
        random_value: Callable[[], float] = random.random,
    ) -> None:
        if requests_per_second <= 0:
            raise ValueError("requests_per_second must be greater than zero")
        self.interval = 1 / requests_per_second
        self.max_retries = max_retries
        self.base_delay = base_delay_seconds
        self.max_delay = max_delay_seconds
        self.on_retry = on_retry
        self.sleep = sleep
        self.now = now
        self.random_value = random_value
        self.next_start_at = 0.0
        self.cooldown_until = 0.0
        self._lock = threading.Lock()

    def _wait_for_turn(self) -> None:
        with self._lock:
            wait_until = max(self.next_start_at, self.cooldown_until)
            wait_seconds = max(0.0, wait_until - self.now())
            if wait_seconds:
                self.sleep(wait_seconds)
            self.next_start_at = self.now() + self.interval

    def run(self, operation: str, request: Callable[[], T]) -> T:
        attempt = 0
        while True:
            self._wait_for_turn()
            try:
                return request()
            except BaseException as error:
                if attempt >= self.max_retries or not is_retryable_gmail_error(error):
                    raise
                delay = min(
                    self.max_delay,
                    self.base_delay * (2**attempt) + self.random_value(),
                )
                _, _, reason = _error_details(error)
                if self.on_retry:
                    self.on_retry(GmailRetryNotice(operation, attempt + 1, self.max_retries, delay, reason))
                self.cooldown_until = max(self.cooldown_until, self.now() + delay)
                attempt += 1
