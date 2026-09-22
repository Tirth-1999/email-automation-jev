import pytest

from email_automation_jev.classification_worker import ClassificationConfig, _is_transient


def test_worker_config_enforces_safe_bounds() -> None:
    assert ClassificationConfig(model="jev-1.13.0", concurrency=5, batch_size=25).batch_size == 25
    with pytest.raises(ValueError):
        ClassificationConfig(model="jev-1.13.0", concurrency=0)
    with pytest.raises(ValueError):
        ClassificationConfig(model="jev-1.13.0", minimum_top_probability=1.1)


@pytest.mark.parametrize("status", [408, 429, 500, 503])
def test_worker_retries_transient_provider_failures(status: int) -> None:
    error = RuntimeError(f"HTTP {status}")
    error.status_code = status  # type: ignore[attr-defined]
    assert _is_transient(error)


def test_worker_does_not_retry_validation_failures() -> None:
    assert not _is_transient(ValueError("invalid question"))
