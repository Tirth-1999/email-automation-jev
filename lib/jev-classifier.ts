import {
  choice,
  noul,
  score,
  TypeSafeClient,
  type ChoiceCriteria,
  type EntryType,
} from "@typesafe-ai/sdk";

export const JEV_CATEGORIES = [
  "applied",
  "outreach",
  "reply_needed",
  "information_needed",
  "interview_assessment",
  "offer",
  "rejected",
  "other",
] as const;

export type JevCategory = (typeof JEV_CATEGORIES)[number];
export type ClassificationDecision = JevCategory | "uncertain";
export const CLASSIFIER_VERSION = "job-email-jev-v6";

export const ACTION_TYPES = [
  "no_action",
  "write_reply",
  "open_link",
  "fill_form",
  "schedule_interview",
  "complete_assessment",
  "send_document",
  "review_offer",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface ClassifiableEmail {
  direction: "incoming" | "outgoing" | "unknown";
  from_name: string | null;
  from_email: string | null;
  to_recipients?: Array<{ name: string | null; email: string | null; raw: string }>;
  subject: string;
  snippet: string;
  body_text: string;
  internal_date?: string;
}

export interface JevClassification {
  classifier_version: string;
  category: JevCategory;
  decision: ClassificationDecision;
  confidence: number;
  top_probability: number;
  probabilities: Record<JevCategory, number>;
  action: {
    choice: ActionType;
    confidence: number;
    probabilities: Record<ActionType, number>;
  };
  urgency: {
    score: number;
    confidence: number;
    probabilities: Record<string, number>;
  };
  draft_reply: {
    probability: number;
    should_draft: boolean;
  };
  model: string;
  input_tokens: number;
}

export const EMAIL_CATEGORY_CRITERIA = {
  applied: {
    meaning: "A job application was submitted or received.",
    includes: [
      "application confirmation",
      "resume submission confirmation",
      "candidate account confirmation that is part of applying",
    ],
    excludes: ["requested interview or assessment", "rejection", "offer"],
  },
  outreach: {
    meaning: "The job seeker sent a message to initiate or follow up on a job-search conversation.",
    includes: [
      "cold outreach to a recruiter or hiring manager",
      "referral request",
      "outgoing follow-up after applying or interviewing",
    ],
    excludes: [
      "an incoming recruiter message asking for a response",
      "a reply that supplies explicitly requested information when reply_needed better describes the event",
    ],
  },
  reply_needed: {
    meaning: "The sender requires a written email or message response from the job seeker.",
    includes: [
      "recruiter asks whether the candidate is interested",
      "right-to-represent confirmation",
      "request to reply with an updated resume, availability, interest, confirmation, or answers",
      "a right-to-represent or recruiter conversation that must be answered in writing",
    ],
    excludes: ["an external form or portal that collects details", "interview scheduling", "assessment or take-home exercise", "offer"],
  },
  information_needed: {
    meaning: "The hiring process requires the job seeker to provide their own administrative, eligibility, demographic, profile, or missing application information to complete or continue an application.",
    includes: [
      "EEO, self-identification, demographic, disability, veteran-status, or WOTC questionnaire",
      "work authorization, sponsorship, contact, address, availability, or candidate-profile form",
      "missing application details or an additional-information form",
      "an administrative recruiting bot or portal questionnaire that does not evaluate ability",
    ],
    excludes: [
      "a written email reply with no form or portal",
      "coding, technical, cognitive, personality, or skills evaluation",
      "interview scheduling or screening conversation",
      "offer paperwork that explicitly finalizes an offer",
      "candidate-experience, application-experience, or interview-process feedback or satisfaction survey",
    ],
    precedence: "Choose this when the requested form collects required information about the candidate rather than evaluating the candidate. The word questionnaire alone does not make something an assessment. A survey asking what the candidate thought about an application or interview belongs to other, not information_needed.",
  },
  interview_assessment: {
    meaning: "The hiring process requests, schedules, confirms, or advances an interview, screening, test, or assessment.",
    includes: [
      "phone/video/in-person interview",
      "AI or one-way screening conversation",
      "coding test, case study, take-home, puzzle, skills/personality evaluation, or assessment",
      "interview or assessment scheduling",
    ],
    excludes: [
      "EEO, WOTC, demographic, eligibility, candidate-profile, or missing-information forms",
      "candidate-experience or interview-process feedback survey",
    ],
    precedence: "Choose this over reply_needed only when the action evaluates the candidate or schedules/conducts an interview. Administrative information forms belong to information_needed.",
  },
  offer: {
    meaning: "The employer explicitly extends an offer or requests information specifically to roll out or finalize an offer.",
    includes: ["offer letter", "offer rollout", "offer acceptance or finalization"],
    excludes: ["generic opportunity or recruiter pitch", "application confirmation"],
  },
  rejected: {
    meaning: "The employer explicitly declines the candidate or says the role was filled and the candidate will not continue.",
    includes: ["not selected", "not moving forward", "position filled", "application unsuccessful"],
    excludes: ["application still under review", "generic silence"],
  },
  other: {
    meaning: "The email does not match one of the defined job-email categories.",
    includes: [
      "security alerts and login codes",
      "job recommendations or marketing",
      "newsletters",
      "delivery failures",
      "candidate account administration without an application outcome",
      "candidate-experience, application-experience, or interview-process feedback or satisfaction survey",
    ],
    excludes: ["any clear application, outreach, reply, information request, interview, assessment, offer, or rejection event"],
  },
} satisfies ChoiceCriteria;

export const categoryQuestion = choice(
  {
    task: "Choose the primary job-search email category represented by this single email.",
    rules: [
      "Use the email direction, sender, recipients, subject, snippet, and body together.",
      "Select the most specific email category, using the precedence stated in the criteria.",
      "Distinguish an administrative information form from an evaluation: EEO, WOTC, eligibility, profile, and missing-detail requests are information_needed; tests and interviews are interview_assessment.",
      "A request for feedback about the application or interview experience is other. It does not become information_needed merely because it links to a form or questionnaire.",
      "Classify only this email. Do not infer ghosting from a single message.",
    ],
  },
  EMAIL_CATEGORY_CRITERIA,
);

export const actionQuestion = choice(
  {
    task: "Identify the primary next action the job seeker should take because of this email.",
    rules: [
      "Choose the concrete action requested by the message, not every possible follow-up.",
      "A reply written in email is different from opening a link or completing a form.",
      "When an assessment or interview step is requested, prefer its specific option over write_reply.",
    ],
  },
  {
    no_action: {
      meaning: "No response or task is required from the job seeker.",
      examples: ["application confirmation", "rejection notice", "marketing email", "optional candidate-experience feedback survey"],
    },
    write_reply: {
      meaning: "Compose and send an email or message response.",
      examples: ["confirm interest", "answer recruiter questions", "agree to representation"],
      excludes: ["only clicking a supplied link", "only filling an external form"],
    },
    open_link: {
      meaning: "Open a supplied link as the main next step, without a more specific form, interview, or assessment action.",
      examples: ["verify an account", "view a portal update"],
    },
    fill_form: {
      meaning: "Complete an administrative application, EEO, WOTC, eligibility, profile, recruiting-bot, or requested-information form.",
      excludes: ["assessment or test", "scheduling an interview", "candidate-experience or interview feedback survey"],
    },
    schedule_interview: {
      meaning: "Choose or confirm an interview or screening time, usually through a scheduling link or calendar response.",
    },
    complete_assessment: {
      meaning: "Complete an assessment, test, case study, take-home, puzzle, or AI/one-way screening exercise.",
    },
    send_document: {
      meaning: "Send a requested resume, work sample, identification, authorization, or other document.",
    },
    review_offer: {
      meaning: "Review, sign, accept, decline, or supply final details for an explicit employment offer.",
    },
  } satisfies ChoiceCriteria,
);

export const urgencyQuestion = score(
  {
    task: "Rate how urgently the job seeker should handle the primary next action in this email.",
    rules: [
      "Judge deadlines and hiring-process consequences stated in the email.",
      "Do not treat promotional urgency or marketing language as a real deadline.",
    ],
  },
  [
    { level: "none", meaning: "No action is required." },
    { level: "low", meaning: "Optional action or no meaningful time pressure." },
    { level: "normal", meaning: "Action is requested, but no near deadline is stated." },
    { level: "high", meaning: "A deadline, interview, assessment, or active recruiter process makes prompt action important." },
    { level: "immediate", meaning: "Action is due today, overdue, expiring very soon, or explicitly urgent." },
  ],
);

export const draftReplyQuestion = noul(
  {
    question: "Should the application prepare a written email reply for the job seeker to review and send?",
    focus: "A draft is appropriate only when the next step requires written communication in reply to this message.",
    exclusions: [
      "opening a link",
      "filling an external form",
      "taking an assessment",
      "using a scheduling page",
      "messages requiring no action",
    ],
  },
  {
    true: {
      meaning: "The job seeker should compose a written response.",
      examples: ["confirm interest", "answer questions", "agree to representation", "send requested information"],
    },
    false: {
      meaning: "No written reply is needed; the action happens elsewhere or no action is required.",
      examples: ["click an assessment link", "fill a form", "schedule through a calendar", "application confirmation"],
    },
  },
);

export const CLASSIFIER_QUESTIONS = {
  category: categoryQuestion,
  action: actionQuestion,
  urgency: urgencyQuestion,
  draft_reply: draftReplyQuestion,
} as const;

export function buildEmailState(email: ClassifiableEmail): EntryType {
  return {
    direction: email.direction,
    sender: { name: email.from_name, email: email.from_email },
    recipients: email.to_recipients || [],
    subject: email.subject,
    snippet: email.snippet,
    body: email.body_text.slice(0, 20_000),
    internal_date: email.internal_date || null,
  };
}

export async function classifyEmailWithJev(
  client: TypeSafeClient,
  email: ClassifiableEmail,
  options: { model: string; minimumTopProbability: number },
): Promise<JevClassification> {
  const response = await client.systemOne({
    model: options.model,
    state: buildEmailState(email),
    questions: CLASSIFIER_QUESTIONS,
  });
  const answer = response.answers.category;
  const action = response.answers.action;
  const urgency = response.answers.urgency;
  const draftReply = response.answers.draft_reply;
  const probabilities = answer.probabilities as Record<JevCategory, number>;
  const topProbability = Math.max(...Object.values(probabilities));
  const draftThreshold = Number(process.env.JEV_DRAFT_REPLY_THRESHOLD || "0.65");
  const decision: ClassificationDecision =
    topProbability >= options.minimumTopProbability ? answer.choice : "uncertain";
  return {
    classifier_version: CLASSIFIER_VERSION,
    category: answer.choice,
    decision,
    confidence: answer.confidence,
    top_probability: topProbability,
    probabilities,
    action: {
      choice: action.choice,
      confidence: action.confidence,
      probabilities: action.probabilities as Record<ActionType, number>,
    },
    urgency: {
      score: urgency.score,
      confidence: urgency.confidence,
      probabilities: urgency.probabilities as unknown as Record<string, number>,
    },
    draft_reply: {
      probability: draftReply.noul,
      should_draft:
        decision === "reply_needed" && draftReply.noul >= draftThreshold,
    },
    model: response.model,
    input_tokens: response.usage.input_tokens,
  };
}
