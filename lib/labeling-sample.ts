import {
  addToReservoir,
  createSeededRandom,
  shuffleInPlace,
} from "./reservoir-sample.js";

export interface LabelingEmail {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  internal_date: string;
  direction: "incoming" | "outgoing" | "unknown";
  from_name: string | null;
  from_email: string | null;
  to_recipients: Array<{ name: string | null; email: string | null; raw: string }>;
  subject: string;
  snippet: string;
  body_text: string;
  label_ids: string[];
}

export const LABEL_CATEGORIES = [
  "applied",
  "outreach",
  "reply_needed",
  "interview_assessment",
  "offer",
  "rejected",
  "other",
  "uncertain",
] as const;

const atcPattern = /(^|[^a-z0-9])atc([^a-z0-9]|$)/i;

export function isAtcEmail(email: LabelingEmail): boolean {
  return [
    email.from_name,
    email.from_email,
    ...email.to_recipients.flatMap((recipient) => [
      recipient.name,
      recipient.email,
      recipient.raw,
    ]),
    email.subject,
  ].some((value) => value != null && atcPattern.test(value));
}

export function selectLabelingSample(
  emails: LabelingEmail[],
  sampleSize: number,
  seed: string,
): Array<LabelingEmail & { selection_reason: "atc_required" | "random" }> {
  const required = emails.filter(isAtcEmail);
  if (required.length > sampleSize) {
    throw new Error(
      `${required.length} ATC emails exceed the requested ${sampleSize}-email review size`,
    );
  }

  const random = createSeededRandom(seed);
  const reservoir: LabelingEmail[] = [];
  let randomCandidatesSeen = 0;
  for (const email of emails) {
    if (isAtcEmail(email)) continue;
    randomCandidatesSeen += 1;
    addToReservoir(reservoir, email, randomCandidatesSeen, sampleSize, random);
  }
  shuffleInPlace(reservoir, random);

  const selected = [
    ...required.map((email) => ({ ...email, selection_reason: "atc_required" as const })),
    ...reservoir
      .slice(0, sampleSize - required.length)
      .map((email) => ({ ...email, selection_reason: "random" as const })),
  ];
  shuffleInPlace(selected, random);
  return selected;
}

const discoveryPattern = /\b(reply|respond|response|action required|action needed|next steps?|additional (questions?|information)|right to represent|representation|send (me )?(your )?(updated )?resume|interview|screening|schedule|meeting|call|assessment|test|case study|challenge|exercise|puzzle|offer|decision|rejected|not moving forward)\b/i;

function discoveryCandidate(email: LabelingEmail): boolean {
  if (email.direction === "outgoing") return true;
  return discoveryPattern.test(`${email.subject}\n${email.snippet}`);
}

function reservoirSample<T>(values: T[], count: number, seed: string): T[] {
  const random = createSeededRandom(seed);
  const reservoir: T[] = [];
  values.forEach((value, index) => {
    addToReservoir(reservoir, value, index + 1, count, random);
  });
  shuffleInPlace(reservoir, random);
  return reservoir;
}

export function selectAdditionalSample(
  emails: LabelingEmail[],
  excludedIds: ReadonlySet<string>,
  count: number,
  seed: string,
  strategy: "balanced" | "random",
): LabelingEmail[] {
  const candidates = emails.filter((email) => !excludedIds.has(email.id));
  if (candidates.length < count) {
    throw new Error(
      `Only ${candidates.length} unseen emails remain; cannot add ${count}`,
    );
  }
  if (strategy === "random") return reservoirSample(candidates, count, seed);

  const priority = candidates.filter(discoveryCandidate);
  const priorityTarget = Math.min(priority.length, Math.ceil(count * 0.7));
  const selectedPriority = reservoirSample(priority, priorityTarget, `${seed}:priority`);
  const selectedIds = new Set(selectedPriority.map((email) => email.id));
  const remaining = candidates.filter((email) => !selectedIds.has(email.id));
  const selectedRandom = reservoirSample(
    remaining,
    count - selectedPriority.length,
    `${seed}:remainder`,
  );
  return [...selectedPriority, ...selectedRandom];
}
