from __future__ import annotations

import os
from typing import Any, cast

from typesafe_sdk import Choice, Noul, Score, TypeSafeClient
from typesafe_sdk._core.response_types import ChoiceAnswer, NoulAnswer, ScoreAnswer

from .models import JevClassification

JEV_CATEGORIES = (
    "applied",
    "outreach",
    "reply_needed",
    "interview_assessment",
    "offer",
    "rejected",
    "other",
)
ACTION_TYPES = (
    "no_action",
    "write_reply",
    "open_link",
    "fill_form",
    "schedule_interview",
    "complete_assessment",
    "send_document",
    "review_offer",
)
CLASSIFIER_VERSION = "job-email-jev-v4"

EMAIL_CATEGORY_CRITERIA: dict[str, Any] = {
    "applied": {
        "meaning": "A job application was submitted or received.",
        "includes": [
            "application confirmation",
            "resume submission confirmation",
            "candidate account confirmation that is part of applying",
        ],
        "excludes": ["requested interview or assessment", "rejection", "offer"],
    },
    "outreach": {
        "meaning": "The job seeker sent a message to initiate or follow up on a job-search conversation.",
        "includes": [
            "cold outreach to a recruiter or hiring manager",
            "referral request",
            "outgoing follow-up after applying or interviewing",
        ],
        "excludes": [
            "an incoming recruiter message asking for a response",
            "a reply that supplies explicitly requested information when reply_needed better describes the event",
        ],
    },
    "reply_needed": {
        "meaning": "The sender requests a response, document, confirmation, or information from the job seeker.",
        "includes": [
            "recruiter asks whether the candidate is interested",
            "right-to-represent confirmation",
            "request for an updated resume, availability, work authorization, relocation, or answers",
            "an application step requiring a reply or action that is not an interview or assessment",
        ],
        "excludes": ["interview scheduling", "assessment or take-home exercise", "offer"],
    },
    "interview_assessment": {
        "meaning": "The hiring process requests, schedules, confirms, or advances an interview, screening, test, or assessment.",
        "includes": [
            "phone/video/in-person interview",
            "AI or one-way screening conversation",
            "coding test, case study, take-home, puzzle, questionnaire, or assessment",
            "interview or assessment scheduling",
        ],
        "precedence": "Choose this over reply_needed when the requested action is an interview, screening, assessment, or scheduling step.",
    },
    "offer": {
        "meaning": "The employer explicitly extends an offer or requests information specifically to roll out or finalize an offer.",
        "includes": ["offer letter", "offer rollout", "offer acceptance or finalization"],
        "excludes": ["generic opportunity or recruiter pitch", "application confirmation"],
    },
    "rejected": {
        "meaning": "The employer explicitly declines the candidate or says the role was filled and the candidate will not continue.",
        "includes": [
            "not selected",
            "not moving forward",
            "position filled",
            "application unsuccessful",
        ],
        "excludes": ["application still under review", "generic silence"],
    },
    "other": {
        "meaning": "The email does not match one of the defined job-email categories.",
        "includes": [
            "security alerts and login codes",
            "job recommendations or marketing",
            "newsletters",
            "delivery failures",
            "candidate account administration without an application outcome",
        ],
        "excludes": ["any clear application, outreach, reply, interview, assessment, offer, or rejection event"],
    },
}

CATEGORY_QUESTION = Choice(
    instructions={
        "task": "Choose the primary job-search email category represented by this single email.",
        "rules": [
            "Use the email direction, sender, recipients, subject, snippet, and body together.",
            "Select the most specific email category, using the precedence stated in the criteria.",
            "Classify only this email. Do not infer ghosting from a single message.",
        ],
    },
    criteria=EMAIL_CATEGORY_CRITERIA,
)
ACTION_QUESTION = Choice(
    instructions={
        "task": "Identify the primary next action the job seeker should take because of this email.",
        "rules": [
            "Choose the concrete action requested by the message, not every possible follow-up.",
            "A reply written in email is different from opening a link or completing a form.",
            "When an assessment or interview step is requested, prefer its specific option over write_reply.",
        ],
    },
    criteria={
        "no_action": {
            "meaning": "No response or task is required from the job seeker.",
            "examples": ["application confirmation", "rejection notice", "marketing email"],
        },
        "write_reply": {
            "meaning": "Compose and send an email or message response.",
            "examples": [
                "confirm interest",
                "answer recruiter questions",
                "agree to representation",
            ],
            "excludes": ["only clicking a supplied link", "only filling an external form"],
        },
        "open_link": {"meaning": "Open a supplied link as the main next step, without a more specific form, interview, or assessment action."},
        "fill_form": {
            "meaning": "Complete an application form, questionnaire, recruiting bot flow, or requested information form.",
            "excludes": ["assessment or test", "scheduling an interview"],
        },
        "schedule_interview": {"meaning": "Choose or confirm an interview or screening time, usually through a scheduling link or calendar response."},
        "complete_assessment": {"meaning": "Complete an assessment, test, case study, take-home, puzzle, or AI/one-way screening exercise."},
        "send_document": {"meaning": "Send a requested resume, work sample, identification, authorization, or other document."},
        "review_offer": {"meaning": "Review, sign, accept, decline, or supply final details for an explicit employment offer."},
    },
)
URGENCY_QUESTION = Score(
    instructions={
        "task": "Rate how urgently the job seeker should handle the primary next action in this email.",
        "rules": [
            "Judge deadlines and hiring-process consequences stated in the email.",
            "Do not treat promotional urgency or marketing language as a real deadline.",
        ],
    },
    criteria=[
        {"level": "none", "meaning": "No action is required."},
        {"level": "low", "meaning": "Optional action or no meaningful time pressure."},
        {"level": "normal", "meaning": "Action is requested, but no near deadline is stated."},
        {
            "level": "high",
            "meaning": "A deadline, interview, assessment, or active recruiter process makes prompt action important.",
        },
        {
            "level": "immediate",
            "meaning": "Action is due today, overdue, expiring very soon, or explicitly urgent.",
        },
    ],
)
DRAFT_REPLY_QUESTION = Noul(
    instructions={
        "question": "Should the application prepare a written email reply for the job seeker to review and send?",
        "focus": "A draft is appropriate only when the next step requires written communication in reply to this message.",
        "exclusions": [
            "opening a link",
            "filling an external form",
            "taking an assessment",
            "using a scheduling page",
            "messages requiring no action",
        ],
    },
    criteria={
        "true": {"meaning": "The job seeker should compose a written response."},
        "false": {"meaning": "No written reply is needed; the action happens elsewhere or no action is required."},
    },
)
CLASSIFIER_QUESTIONS = {
    "category": CATEGORY_QUESTION,
    "action": ACTION_QUESTION,
    "urgency": URGENCY_QUESTION,
    "draft_reply": DRAFT_REPLY_QUESTION,
}


def build_email_state(email: dict[str, Any]) -> dict[str, Any]:
    return {
        "direction": email["direction"],
        "sender": {"name": email.get("from_name"), "email": email.get("from_email")},
        "recipients": email.get("to_recipients", []),
        "subject": email["subject"],
        "snippet": email["snippet"],
        "body": email["body_text"][:20_000],
        "internal_date": email.get("internal_date"),
    }


def classify_email_with_jev(client: TypeSafeClient, email: dict[str, Any], *, model: str, minimum_top_probability: float) -> JevClassification:
    # The SDK runtime accepts these four concrete question objects; its inferred
    # dictionary union is narrower than the public system_one annotation.
    response = client.system_one(state=build_email_state(email), questions=cast(Any, CLASSIFIER_QUESTIONS), model=model)
    category = cast(ChoiceAnswer, response.answers["category"])
    action = cast(ChoiceAnswer, response.answers["action"])
    urgency = cast(ScoreAnswer, response.answers["urgency"])
    draft = cast(NoulAnswer, response.answers["draft_reply"])
    probabilities = cast(dict[str, float], category.probabilities)
    top_probability = max(probabilities.values())
    decision = category.choice if top_probability >= minimum_top_probability else "uncertain"
    draft_threshold = float(os.getenv("JEV_DRAFT_REPLY_THRESHOLD", "0.65"))
    return JevClassification(
        classifier_version=CLASSIFIER_VERSION,
        category=cast(Any, category.choice),
        decision=cast(Any, decision),
        confidence=category.confidence,
        top_probability=top_probability,
        probabilities=cast(Any, probabilities),
        action={
            "choice": action.choice,
            "confidence": action.confidence,
            "probabilities": action.probabilities,
        },
        urgency={
            "score": urgency.score,
            "confidence": urgency.confidence,
            "probabilities": {str(key): value for key, value in urgency.probabilities.items()},
        },
        draft_reply={
            "probability": draft.noul,
            "should_draft": decision == "reply_needed" and draft.noul >= draft_threshold,
        },
        model=response.model,
        input_tokens=response.usage.input_tokens or 0,
    )
