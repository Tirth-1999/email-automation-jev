from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv

from .classification_repository import (
    create_classification_run,
    enqueue_classification_emails,
    find_classifier_version,
    request_classification_cancellation,
)
from .classification_worker import (
    ClassificationConfig,
    preview_selection,
    run_classification,
    select_email_ids,
)
from .jev_classifier import CLASSIFIER_VERSION
from .labeling_sample import LABEL_CATEGORIES, select_additional_sample
from .labeling_store import read_all_active_emails, read_json, to_review_email, write_private_json
from .repository import create_database_client

ROOT = Path.cwd()
UI_ROOT = ROOT / "apps/dashboard"
POOL_PATH = ROOT / "data/labeling/generated/email-review-pool.json"
LABELS_PATH = ROOT / "data/labeling/generated/labeled-emails.json"
MUTATION_LOCK = threading.Lock()
EMAIL_CACHE: list[dict] | None = None
COMMAND_SCOPES = {"all", "unclassified", "uncertain", "failed"}


def now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def empty_labels() -> dict:
    return {"version": 1, "updated_at": now(), "categories": list(LABEL_CATEGORIES), "emails": []}


def labels_store() -> dict:
    return read_json(LABELS_PATH) if LABELS_PATH.exists() else empty_labels()


def database_client():
    return create_database_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def mailbox_account(database):
    rows = database.table("gmail_accounts").select("id,gmail_address").order("created_at").limit(1).execute().data or []
    if not rows:
        raise ValueError("No Gmail account is registered. Run Gmail ingestion first.")
    return rows[0]


def command_config(value: dict) -> ClassificationConfig:
    return ClassificationConfig(
        model=str(value.get("model") or os.getenv("TYPESAFE_MODEL", "jev-1.13.0")),
        minimum_top_probability=float(value.get("minimum_top_probability", os.getenv("JEV_MIN_TOP_PROBABILITY", "0.6"))),
        concurrency=int(value.get("concurrency", 5)),
        batch_size=int(value.get("batch_size", 25)),
    )


def start_command_run(value: dict) -> dict:
    database = database_client()
    account = mailbox_account(database)
    config = command_config(value)
    classifier = find_classifier_version(database, str(value.get("classifier_version") or CLASSIFIER_VERSION))
    if not classifier:
        raise ValueError("The requested classifier version is not registered in Supabase.")
    if classifier.get("status") != "approved":
        raise ValueError("Only an approved classifier version can run in production.")
    scope = str(value.get("scope") or "unclassified")
    if scope not in COMMAND_SCOPES:
        raise ValueError("scope must be all, unclassified, uncertain, or failed")
    maximum = int(value["maximum"]) if value.get("maximum") is not None else None
    email_ids = select_email_ids(database, account["id"], scope=scope, maximum=maximum)
    run = create_classification_run(
        database,
        {
            "gmail_account_id": account["id"],
            "classifier_version_id": classifier["id"],
            "run_kind": "production",
            "model_requested": config.model,
            "selection": {"scope": scope, "maximum": maximum},
            "minimum_top_probability": config.minimum_top_probability,
            "concurrency": config.concurrency,
            "batch_size": config.batch_size,
        },
    )
    run_id = str(run["id"])
    enqueue_classification_emails(database, run_id, email_ids)

    def background() -> None:
        try:
            run_classification(
                database,
                run_id=run_id,
                config=config,
                api_key=os.getenv("TYPESAFE_API_KEY"),
            )
        except BaseException as error:
            database.table("classification_runs").update({"status": "failed", "finished_at": now(), "error_message": str(error)[:2000]}).eq(
                "id", run_id
            ).execute()

    threading.Thread(target=background, name=f"classification-{run_id[:8]}", daemon=True).start()
    return {**run, "queued_email_count": len(email_ids)}


class Handler(BaseHTTPRequestHandler):
    def json_response(self, status: int, value: object) -> None:
        payload = (json.dumps(value) + "\n").encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def input(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length > 1_000_000:
            raise ValueError("Request body is too large")
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/command/status":
            database = database_client()
            run_id = parse_qs(parsed.query).get("run_id", [None])[0]
            if run_id:
                run = database.table("classification_run_summary").select("*").eq("id", run_id).single().execute().data
                return self.json_response(200, {"run": run})
            runs = database.table("classification_run_summary").select("*").order("created_at", desc=True).limit(20).execute().data or []
            return self.json_response(200, {"runs": runs, "classifier_version": CLASSIFIER_VERSION})
        if parsed.path == "/api/command/preview":
            database = database_client()
            account = mailbox_account(database)
            query = parse_qs(parsed.query)
            scope = query.get("scope", ["unclassified"])[0]
            if scope not in COMMAND_SCOPES:
                return self.json_response(400, {"error": "Invalid classification scope"})
            maximum_text = query.get("maximum", [None])[0]
            maximum = int(maximum_text) if maximum_text else None
            return self.json_response(200, preview_selection(database, account["id"], scope=scope, maximum=maximum))
        if parsed.path == "/api/labels":
            return self.json_response(200, labels_store())
        if parsed.path == "/api/benchmark":
            all_labeled = parse_qs(parsed.query).get("scope") == ["all"]
            result = ROOT / "data/labeling/generated" / ("jev-all-labeled-results.json" if all_labeled else "jev-evaluation-results.json")
            evaluation = ROOT / "data/labeling/generated/jev-evaluation.json"
            count = len(labels_store()["emails"]) if all_labeled else len(read_json(evaluation)["emails"])
            command = "uv run email-jev-evaluate --all-labeled" if all_labeled else "uv run email-jev-evaluate"
            if result.exists():
                report = read_json(result)
                if report.get("classifier_version") == CLASSIFIER_VERSION:
                    return self.json_response(200, {"status": "complete", "report": report})
                return self.json_response(
                    200,
                    {
                        "status": "stale",
                        "evaluation_count": count,
                        "command": command,
                        "current_classifier_version": CLASSIFIER_VERSION,
                        "result_classifier_version": report.get("classifier_version", "legacy-unversioned"),
                    },
                )
            return self.json_response(
                200,
                {
                    "status": "not_run",
                    "evaluation_count": count,
                    "api_key_configured": bool(os.getenv("TYPESAFE_API_KEY", "").strip()),
                    "command": command,
                },
            )
        routes = {
            "/": UI_ROOT / "index.html",
            "/index.html": UI_ROOT / "index.html",
            "/src/styles.css": UI_ROOT / "src/styles.css",
            "/src/app.js": UI_ROOT / "src/app.js",
            "/sample.json": POOL_PATH,
        }
        path = routes.get(parsed.path)
        if not path or not path.exists():
            self.send_error(404)
            return
        mime = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "text/javascript",
            ".json": "application/json",
        }.get(path.suffix, "application/octet-stream")
        content = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{mime}; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self) -> None:  # noqa: N802
        global EMAIL_CACHE
        try:
            value = self.input()
            with MUTATION_LOCK:
                if self.path == "/api/labels":
                    email_id, label = value.get("email_id", ""), value.get("manual_label", "")
                    if not email_id or label not in LABEL_CATEGORIES:
                        return self.json_response(400, {"error": "A valid email_id and manual_label are required"})
                    pool, store = read_json(POOL_PATH), labels_store()
                    email = next((item for item in pool["emails"] if item["email_id"] == email_id), None)
                    if not email:
                        raise ValueError("Email is not part of the review pool")
                    labeled = {
                        **email,
                        "manual_label": label,
                        "review_notes": str(value.get("review_notes", ""))[:5000],
                        "labeled_at": now(),
                    }
                    store["emails"] = [item for item in store["emails"] if item["email_id"] != email_id] + [labeled]
                    store["updated_at"] = labeled["labeled_at"]
                    write_private_json(LABELS_PATH, store)
                    return self.json_response(
                        200,
                        {
                            "labeled_count": len(store["emails"]),
                            "labeled_at": labeled["labeled_at"],
                        },
                    )
                if self.path == "/api/command/preview":
                    database = database_client()
                    account = mailbox_account(database)
                    scope = str(value.get("scope") or "unclassified")
                    if scope not in COMMAND_SCOPES:
                        return self.json_response(400, {"error": "Invalid classification scope"})
                    maximum = int(value["maximum"]) if value.get("maximum") is not None else None
                    return self.json_response(
                        200,
                        preview_selection(database, account["id"], scope=scope, maximum=maximum),
                    )
                if self.path == "/api/command/runs":
                    return self.json_response(202, start_command_run(value))
                if self.path == "/api/command/cancel":
                    database = database_client()
                    run_id = str(value.get("run_id") or "")
                    if not run_id:
                        return self.json_response(400, {"error": "run_id is required"})
                    request_classification_cancellation(database, run_id)
                    return self.json_response(202, {"run_id": run_id, "status": "cancellation_requested"})
                if self.path == "/api/resample":
                    count = value.get("count", 50)
                    strategy = "random" if value.get("strategy") == "random" else "balanced"
                    if not isinstance(count, int) or not 10 <= count <= 200:
                        return self.json_response(400, {"error": "count must be an integer from 10 to 200"})
                    pool = read_json(POOL_PATH)
                    if EMAIL_CACHE is None:
                        database = create_database_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
                        EMAIL_CACHE = read_all_active_emails(database)
                    selected = select_additional_sample(
                        EMAIL_CACHE,
                        {item["email_id"] for item in pool["emails"]},
                        count,
                        f"add-{now()}-{uuid.uuid4()}",
                        strategy,
                    )
                    batch_id = f"batch-{len(pool['batches']) + 1}-{str(uuid.uuid4())[:8]}"
                    additions = [
                        to_review_email(
                            email,
                            len(pool["emails"]) + index,
                            batch_id,
                            "balanced_discovery" if strategy == "balanced" else "random",
                        )
                        for index, email in enumerate(selected, 1)
                    ]
                    batch = {
                        "id": batch_id,
                        "created_at": now(),
                        "count": len(additions),
                        "strategy": strategy,
                    }
                    pool["emails"].extend(additions)
                    pool["batches"].append(batch)
                    pool["updated_at"] = now()
                    pool["source_email_count"] = len(EMAIL_CACHE)
                    write_private_json(POOL_PATH, pool)
                    return self.json_response(
                        200,
                        {
                            "emails": additions,
                            "batch": batch,
                            "total_count": len(pool["emails"]),
                            "unseen_remaining": len(EMAIL_CACHE) - len(pool["emails"]),
                        },
                    )
            self.send_error(404)
        except Exception as error:
            self.json_response(500, {"error": str(error)})

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    load_dotenv()
    if not POOL_PATH.exists():
        raise SystemExit("Missing email-review-pool.json. Run `uv run email-sample` first.")
    port = int(os.getenv("LABELING_UI_PORT", "4173"))
    print(f"Email Automation Jev dashboard: http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
