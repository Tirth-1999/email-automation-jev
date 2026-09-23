import {
  noul,
  type EntryType,
  type TypeSafeClient,
} from "@typesafe-ai/sdk";
import {
  APPLICATION_STATUSES,
  applicationGroupingIdentity,
  applicationRelationshipPairKey,
  deterministicThreadRelationship,
  type ApplicationEmailEvidence,
  type ThreadRelationshipDecision,
} from "./application-grouping.js";

export interface ApplicationRelationshipEvaluation {
  decisions: Map<string, ThreadRelationshipDecision>;
  checkedCount: number;
  matchedCount: number;
  failedCount: number;
  inputTokens: number;
}

interface AmbiguousPair {
  left: ApplicationEmailEvidence;
  right: ApplicationEmailEvidence;
}

const SAME_APPLICATION_CRITERIA = {
  true: {
    meaning: "Both emails are evidence about the same specific job application or recruiting opportunity.",
    includes: [
      "a candidate reply and the recruiter message it answers",
      "application confirmation followed by an interview, assessment, rejection, or offer for that same role",
      "minor subject or sender differences where company, role, requisition, and conversation context still align",
    ],
  },
  false: {
    meaning: "The emails concern different employers, roles, requisitions, or independent applications.",
    includes: [
      "a job board reused one Gmail thread for applications to different companies",
      "different requisition IDs or clearly different destination employers",
      "generic platform notifications that happen to share sender or thread metadata",
    ],
  },
};

function relationshipQuestion(leftIndex: number, rightIndex: number) {
  return noul(
    {
      question: "Do these two messages describe the same specific job application or recruiting opportunity?",
      first_message: `messages[${leftIndex}]`,
      second_message: `messages[${rightIndex}]`,
      rules: [
        "Treat Gmail thread identity as weak transport evidence, not proof of a match.",
        "Prioritize destination company, job title, requisition ID, candidate reply context, and hiring-stage continuity.",
        "Job-board emails for different destination companies are different applications even when Gmail groups them into one thread.",
      ],
    },
    SAME_APPLICATION_CRITERIA,
  );
}

function eligibleEvidence(rows: ApplicationEmailEvidence[]): ApplicationEmailEvidence[] {
  const statuses = new Set<string>(APPLICATION_STATUSES);
  return rows.filter((row) => statuses.has(row.effective_category || "") && row.effective_category !== "ghosted");
}

export function planAmbiguousThreadPairs(
  rows: ApplicationEmailEvidence[],
  maxPairsPerThread = 24,
): Map<string, AmbiguousPair[]> {
  const byThread = new Map<string, ApplicationEmailEvidence[]>();
  for (const row of eligibleEvidence(rows)) {
    const key = `${row.gmail_account_id}:${row.gmail_thread_id}`;
    const members = byThread.get(key) || [];
    members.push(row);
    byThread.set(key, members);
  }
  const plans = new Map<string, AmbiguousPair[]>();
  for (const [threadKey, unsortedMembers] of byThread) {
    const members = [...unsortedMembers].sort(
      (left, right) => Date.parse(left.internal_date) - Date.parse(right.internal_date) || left.email_id.localeCompare(right.email_id),
    );
    const pairs: AmbiguousPair[] = [];
    for (let rightIndex = 1; rightIndex < members.length && pairs.length < maxPairsPerThread; rightIndex += 1) {
      const right = members[rightIndex];
      if (!right) continue;
      for (let leftIndex = rightIndex - 1; leftIndex >= 0 && pairs.length < maxPairsPerThread; leftIndex -= 1) {
        const left = members[leftIndex];
        if (!left || deterministicThreadRelationship(left, right) !== "ambiguous") continue;
        pairs.push({ left, right });
      }
    }
    if (pairs.length) plans.set(threadKey, pairs);
  }
  return plans;
}

async function mapConcurrent<T>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const value = values[cursor];
      cursor += 1;
      if (value !== undefined) await mapper(value);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
}

export async function evaluateApplicationRelationships(
  client: TypeSafeClient,
  rows: ApplicationEmailEvidence[],
  options: {
    model: string;
    sameThreshold?: number;
    concurrency?: number;
    maxPairsPerThread?: number;
  },
): Promise<ApplicationRelationshipEvaluation> {
  const plans = planAmbiguousThreadPairs(rows, options.maxPairsPerThread ?? 24);
  const decisions = new Map<string, ThreadRelationshipDecision>();
  let checkedCount = 0;
  let matchedCount = 0;
  let failedCount = 0;
  let inputTokens = 0;
  const sameThreshold = options.sameThreshold ?? 0.72;

  await mapConcurrent([...plans.values()], options.concurrency ?? 8, async (pairs) => {
    const messages: ApplicationEmailEvidence[] = [];
    const messageIndexes = new Map<string, number>();
    for (const pair of pairs) {
      for (const email of [pair.left, pair.right]) {
        if (messageIndexes.has(email.email_id)) continue;
        messageIndexes.set(email.email_id, messages.length);
        messages.push(email);
      }
    }
    const state: EntryType = {
      messages: messages.map((email) => {
        const identity = applicationGroupingIdentity(email);
        return {
          direction: email.direction || "unknown",
          sender_name: email.from_name || "",
          sender_email: email.from_email || "",
          subject: email.subject || "",
          snippet: String(email.snippet || "").slice(0, 1_500),
          detected_company: identity.company || "",
          detected_role: identity.role || "",
          detected_requisition_id: identity.requisitionId || "",
          date: email.internal_date,
        };
      }),
    };
    const questions = Object.fromEntries(pairs.map((pair, index) => [
      `same_application_${index}`,
      relationshipQuestion(
        messageIndexes.get(pair.left.email_id) || 0,
        messageIndexes.get(pair.right.email_id) || 0,
      ),
    ]));
    try {
      const response = await client.systemOne({ model: options.model, state, questions });
      inputTokens += response.usage.input_tokens;
      pairs.forEach((pair, index) => {
        const probability = response.answers[`same_application_${index}`]?.noul ?? 0.5;
        const sameApplication = probability >= sameThreshold;
        decisions.set(applicationRelationshipPairKey(pair.left.email_id, pair.right.email_id), {
          sameApplication,
          probability,
          source: "jev",
        });
        checkedCount += 1;
        if (sameApplication) matchedCount += 1;
      });
    } catch {
      failedCount += pairs.length;
      for (const pair of pairs) {
        decisions.set(applicationRelationshipPairKey(pair.left.email_id, pair.right.email_id), {
          sameApplication: false,
          probability: 0.5,
          source: "jev",
        });
      }
    }
  });

  return { decisions, checkedCount, matchedCount, failedCount, inputTokens };
}
