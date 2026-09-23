export const APPLICATION_STATUSES = [
  "outreach",
  "applied",
  "reply_needed",
  "interview_assessment",
  "offer",
  "rejected",
  "ghosted",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ApplicationEmailEvidence {
  email_id: string;
  gmail_account_id: string;
  gmail_thread_id: string;
  internal_date: string;
  direction: string | null;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  snippet?: string | null;
  effective_category: string | null;
  human_category: string | null;
}

export interface ApplicationEventCandidate {
  emailId: string | null;
  status: ApplicationStatus;
  eventAt: string;
  source: "email_classification" | "human_correction" | "ghosting_rule";
  explanation: string;
}

export interface ApplicationCandidate {
  gmailAccountId: string;
  groupingKey: string;
  company: string | null;
  role: string | null;
  requisitionId: string | null;
  currentStatus: ApplicationStatus;
  firstActivityAt: string;
  lastActivityAt: string;
  ghostedAt: string | null;
  messages: Array<{ emailId: string; confidence: number }>;
  events: ApplicationEventCandidate[];
}

export interface GhostingDecision {
  shouldGhost: boolean;
  ghostedAt: string | null;
  reason: string;
}

const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "linkedin.com",
  "myworkday.com",
  "greenhouse-mail.io",
  "hire.lever.co",
  "ashbyhq.com",
  "jobvite.com",
  "icims.com",
  "smartrecruiters.com",
]);

const COMPANY_SUFFIX = /\s+(?:careers?|recruiting|recruitment|talent acquisition|hiring team|workday|notifications?|no[ -]?reply).*$/i;
function clean(value: string | null | undefined): string | null {
  const result = String(value || "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, "")
    .trim();
  return result || null;
}

function titleFromSlug(value: string): string {
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function senderDomain(email: string | null): string | null {
  const domain = email?.toLowerCase().split("@")[1]?.replace(/^mail\./, "") || null;
  if (!domain || GENERIC_DOMAINS.has(domain)) return null;
  const pieces = domain.split(".");
  const root = pieces.length >= 2 ? pieces.at(-2) : pieces[0];
  return root ? titleFromSlug(root) : null;
}

export function extractRequisitionId(subject: string | null): string | null {
  const text = clean(subject);
  if (!text) return null;
  const match = text.match(/\b(?:req(?:uisition)?[ _:#-]*|jr[ _:#-]*|r[-_]|job[ _:#-]*)([a-z0-9-]{4,})\b/i);
  return match ? clean(match[0])?.toUpperCase().replace(/\s+/g, "") || null : null;
}

export function extractCompany(evidence: ApplicationEmailEvidence): string | null {
  const subject = clean(evidence.subject) || "";
  const patterns = [
    /(?:application|applying)(?: was sent)? to\s+(.+?)(?:[.!|]|$)/i,
    /(?:application|interest) (?:with|at|in)\s+(.+?)(?:[.!|]|$)/i,
    /thanks? for applying to\s+(.+?)(?:[.!|]|$)/i,
    /thank you for (?:your interest in|applying to)\s+(.+?)(?:[.!|]|$)/i,
    /\b(?:at|with)\s+(.+?)(?:\s+-\s+|\s+\(?REQ[ _:#-]|[.!|]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    const candidate = clean(match?.[1]);
    if (candidate && candidate.length <= 80) {
      return candidate
        .replace(/\s+has been received.*$/i, "")
        .replace(COMPANY_SUFFIX, "")
        .trim();
    }
  }

  if (evidence.direction !== "outgoing") {
    const fromName = clean(evidence.from_name)?.replace(COMPANY_SUFFIX, "").trim();
    if (fromName && !/^(?:greenhouse|workday|do not reply|no reply|recruiting team)$/i.test(fromName)) {
      return fromName;
    }

    const address = evidence.from_email?.toLowerCase() || "";
    if (address.endsWith("@myworkday.com") || address.endsWith("@otp.workday.com")) {
      const local = address.split("@")[0];
      if (local && !/^(?:no-?reply|workday|notification)$/i.test(local)) return titleFromSlug(local);
    }
    return senderDomain(evidence.from_email);
  }
  return null;
}

export function extractRole(subject: string | null, company: string | null): string | null {
  const text = clean(subject);
  if (!text) return null;
  const patterns = [
    /application (?:for|to) (?:the position )?(.+?) (?:at|with) .+$/i,
    /(?:position|role)\s+(.+?)\s+at\s+.+$/i,
    /application update:\s*(.+?)(?:\s+-\s+|$)/i,
    /next steps? (?:for|in)\s+(.+?)(?:\s+at\s+|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = clean(match?.[1]);
    if (candidate && candidate.length >= 3 && candidate.length <= 140) return candidate;
  }
  return null;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

export function applicationGroupingIdentity(evidence: ApplicationEmailEvidence): {
  key: string;
  company: string | null;
  role: string | null;
  requisitionId: string | null;
  confidence: number;
} {
  const company = extractCompany(evidence);
  const role = extractRole(evidence.subject, company);
  const requisitionId = extractRequisitionId(evidence.subject);
  if (company && requisitionId) {
    return { key: `company:${slug(company)}:req:${slug(requisitionId)}`, company, role, requisitionId, confidence: 0.98 };
  }
  if (company && role) {
    return { key: `company:${slug(company)}:role:${slug(role)}`, company, role, requisitionId, confidence: 0.86 };
  }
  return {
    key: company
      ? `company:${slug(company)}:thread:${evidence.gmail_thread_id}`
      : `thread:${evidence.gmail_thread_id}`,
    company,
    role,
    requisitionId,
    confidence: company ? 0.72 : 0.6,
  };
}

function statusForCategory(category: string | null): ApplicationStatus | null {
  return APPLICATION_STATUSES.includes(category as ApplicationStatus)
    ? category as ApplicationStatus
    : null;
}

export function conversationGhostingDecision(
  rows: ApplicationEmailEvidence[],
  now: Date,
  ghostAfterDays: number,
): GhostingDecision {
  const ordered = [...rows].sort((left, right) => Date.parse(left.internal_date) - Date.parse(right.internal_date));
  const latest = ordered.at(-1);
  const incomingCount = ordered.filter((row) => row.direction === "incoming").length;
  const outgoingCount = ordered.filter((row) => row.direction === "outgoing").length;
  const establishedExchange = ordered.length >= 3 && incomingCount > 0 && outgoingCount > 0;
  if (!establishedExchange) {
    return {
      shouldGhost: false,
      ghostedAt: null,
      reason: "Ghosting requires an established conversation with at least three messages in both directions",
    };
  }
  if (latest?.direction !== "outgoing") {
    return {
      shouldGhost: false,
      ghostedAt: null,
      reason: "The latest message was not sent by the job seeker",
    };
  }
  const latestAt = Date.parse(latest.internal_date);
  const ageDays = (now.getTime() - latestAt) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < ghostAfterDays) {
    return {
      shouldGhost: false,
      ghostedAt: null,
      reason: `The latest outgoing message has not been unanswered for ${ghostAfterDays} days`,
    };
  }
  return {
    shouldGhost: true,
    ghostedAt: new Date(latestAt + ghostAfterDays * 86_400_000).toISOString(),
    reason: `Established ${ordered.length}-message conversation received no reply for ${ghostAfterDays} days after the latest outgoing email`,
  };
}

const STATUS_RANK: Record<ApplicationStatus, number> = {
  outreach: 1,
  applied: 2,
  reply_needed: 3,
  interview_assessment: 4,
  rejected: 5,
  offer: 6,
  ghosted: 7,
};

export type ThreadRelationshipDisposition = "same" | "different" | "ambiguous";

export interface ThreadRelationshipDecision {
  sameApplication: boolean;
  probability: number;
  source: "jev" | "rule";
}

export function applicationRelationshipPairKey(leftEmailId: string, rightEmailId: string): string {
  return [leftEmailId, rightEmailId].sort().join(":");
}

function normalizedSubject(subject: string | null): string {
  return String(subject || "")
    .replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function deterministicThreadRelationship(
  left: ApplicationEmailEvidence,
  right: ApplicationEmailEvidence,
): ThreadRelationshipDisposition {
  if (left.gmail_account_id !== right.gmail_account_id || left.gmail_thread_id !== right.gmail_thread_id) {
    return "different";
  }
  const leftIdentity = applicationGroupingIdentity(left);
  const rightIdentity = applicationGroupingIdentity(right);
  if (leftIdentity.requisitionId && rightIdentity.requisitionId) {
    return slug(leftIdentity.requisitionId) === slug(rightIdentity.requisitionId) ? "same" : "different";
  }
  if (leftIdentity.company && rightIdentity.company) {
    if (slug(leftIdentity.company) !== slug(rightIdentity.company)) return "ambiguous";
    if (leftIdentity.role && rightIdentity.role) {
      return slug(leftIdentity.role) === slug(rightIdentity.role) ? "same" : "ambiguous";
    }
    return "same";
  }
  if (left.direction === "outgoing" || right.direction === "outgoing") return "same";
  const leftSubject = normalizedSubject(left.subject);
  const rightSubject = normalizedSubject(right.subject);
  if (leftSubject && leftSubject === rightSubject) return "same";
  return "ambiguous";
}

export function buildApplicationCandidates(
  evidenceRows: ApplicationEmailEvidence[],
  options: {
    now?: Date;
    ghostAfterDays?: number;
    relationshipDecisions?: ReadonlyMap<string, ThreadRelationshipDecision>;
    ambiguousThreadFallback?: "same" | "different";
  } = {},
): ApplicationCandidate[] {
  const now = options.now || new Date();
  const ghostAfterDays = options.ghostAfterDays ?? 21;
  const eligible = evidenceRows
    .filter((evidence) => {
      const status = statusForCategory(evidence.effective_category);
      return Boolean(status && status !== "ghosted");
    })
    .map((evidence) => ({ evidence, identity: applicationGroupingIdentity(evidence) }));

  // A Gmail thread is transport evidence, not an application identity. Some
  // job boards reuse one Gmail thread for unrelated employers. Deterministic
  // matches are joined directly; ambiguous pairs use a precomputed Jev Noul.
  const parents = eligible.map((_, index) => index);
  const componentMembers = new Map<number, Set<number>>(
    eligible.map((_, index) => [index, new Set([index])]),
  );
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root] as number;
    while (parents[index] !== index) {
      const next = parents[index] as number;
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const blockedPairs = new Set<string>();
  const indexPairKey = (left: number, right: number): string =>
    left < right ? `${left}:${right}` : `${right}:${left}`;
  const unionUnlessBlocked = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const leftMembers = componentMembers.get(leftRoot) || new Set([leftRoot]);
    const rightMembers = componentMembers.get(rightRoot) || new Set([rightRoot]);
    for (const leftMember of leftMembers) {
      for (const rightMember of rightMembers) {
        if (blockedPairs.has(indexPairKey(leftMember, rightMember))) return;
      }
    }
    parents[rightRoot] = leftRoot;
    for (const member of rightMembers) leftMembers.add(member);
    componentMembers.set(leftRoot, leftMembers);
    componentMembers.delete(rightRoot);
  };
  const membersByThread = new Map<string, number[]>();
  const firstByStrongIdentity = new Map<string, number>();
  const strongIdentityPairs: Array<[number, number]> = [];
  eligible.forEach(({ evidence, identity }, index) => {
    const threadKey = `${evidence.gmail_account_id}:${evidence.gmail_thread_id}`;
    const threadMembers = membersByThread.get(threadKey) || [];
    threadMembers.push(index);
    membersByThread.set(threadKey, threadMembers);

    // A cold outreach is an independent opportunity until thread continuity or
    // later inbound evidence establishes a real conversation. Do not merge
    // separate cold emails solely because they target the same company/role.
    const isStrongIdentity = evidence.effective_category !== "outreach"
      && Boolean(identity.requisitionId || (identity.company && identity.role));
    if (!isStrongIdentity) return;
    const semanticKey = `${evidence.gmail_account_id}:${identity.key}`;
    const semanticMatch = firstByStrongIdentity.get(semanticKey);
    if (semanticMatch === undefined) firstByStrongIdentity.set(semanticKey, index);
    else strongIdentityPairs.push([semanticMatch, index]);
  });
  const positiveThreadPairs: Array<[number, number]> = [];
  for (const threadMembers of membersByThread.values()) {
    for (let leftOffset = 0; leftOffset < threadMembers.length; leftOffset += 1) {
      for (let rightOffset = leftOffset + 1; rightOffset < threadMembers.length; rightOffset += 1) {
        const leftIndex = threadMembers[leftOffset];
        const rightIndex = threadMembers[rightOffset];
        if (leftIndex === undefined || rightIndex === undefined) continue;
        const left = eligible[leftIndex]?.evidence;
        const right = eligible[rightIndex]?.evidence;
        if (!left || !right) continue;
        const disposition = deterministicThreadRelationship(left, right);
        if (disposition === "same") {
          positiveThreadPairs.push([leftIndex, rightIndex]);
          continue;
        }
        if (disposition === "different") {
          blockedPairs.add(indexPairKey(leftIndex, rightIndex));
          continue;
        }
        const decision = options.relationshipDecisions?.get(
          applicationRelationshipPairKey(left.email_id, right.email_id),
        );
        if (decision?.sameApplication || (!decision && options.ambiguousThreadFallback === "same")) {
          positiveThreadPairs.push([leftIndex, rightIndex]);
        } else {
          // A negative or unavailable ambiguous decision is a hard boundary.
          // This prevents A↔B and B↔C positives from indirectly merging a
          // known A↮C pair in reused job-board threads.
          blockedPairs.add(indexPairKey(leftIndex, rightIndex));
        }
      }
    }
  }
  for (const [left, right] of positiveThreadPairs) unionUnlessBlocked(left, right);
  for (const [left, right] of strongIdentityPairs) unionUnlessBlocked(left, right);

  const connected = new Map<number, typeof eligible>();
  eligible.forEach((item, index) => {
    const root = find(index);
    const group = connected.get(root) || [];
    group.push(item);
    connected.set(root, group);
  });

  const grouped = [] as Array<{ identity: ReturnType<typeof applicationGroupingIdentity>; rows: ApplicationEmailEvidence[] }>;
  for (const members of connected.values()) {
    const strongest = members.reduce((best, member) =>
      member.identity.confidence > best.identity.confidence ? member : best);
    const identity = { ...strongest.identity };
    for (const member of members) {
      if (!identity.company && member.identity.company) identity.company = member.identity.company;
      if (!identity.role && member.identity.role) identity.role = member.identity.role;
      if (!identity.requisitionId && member.identity.requisitionId) identity.requisitionId = member.identity.requisitionId;
    }
    grouped.push({ identity, rows: members.map((member) => member.evidence) });
  }
  const baseKeyCounts = new Map<string, number>();
  for (const group of grouped) {
    const accountId = group.rows[0]?.gmail_account_id || "";
    const scopedKey = `${accountId}:${group.identity.key}`;
    baseKeyCounts.set(scopedKey, (baseKeyCounts.get(scopedKey) || 0) + 1);
  }
  for (const group of grouped) {
    const accountId = group.rows[0]?.gmail_account_id || "";
    const scopedKey = `${accountId}:${group.identity.key}`;
    if ((baseKeyCounts.get(scopedKey) || 0) <= 1) continue;
    const anchor = [...group.rows]
      .sort((left, right) => Date.parse(left.internal_date) - Date.parse(right.internal_date) || left.email_id.localeCompare(right.email_id))[0];
    group.identity.key = `${group.identity.key}:segment:${slug(anchor?.email_id || "unknown")}`;
  }

  return grouped.map(({ identity, rows }) => {
    rows.sort((left, right) => Date.parse(left.internal_date) - Date.parse(right.internal_date));
    const events = rows.flatMap((row): ApplicationEventCandidate[] => {
      const status = statusForCategory(row.effective_category);
      if (!status) return [];
      return [{
        emailId: row.email_id,
        status,
        eventAt: row.internal_date,
        source: row.human_category ? "human_correction" : "email_classification",
        explanation: row.human_category
          ? "Human-corrected email category"
          : "Latest approved Jev email category",
      }];
    });
    let currentStatus = events.reduce<ApplicationStatus>(
      (current, event) => STATUS_RANK[event.status] > STATUS_RANK[current] ? event.status : current,
      events[0]?.status || "applied",
    );
    const firstActivityAt = rows[0]?.internal_date || now.toISOString();
    const lastActivityAt = rows.at(-1)?.internal_date || firstActivityAt;
    let ghostedAt: string | null = null;
    const terminal = currentStatus === "offer" || currentStatus === "rejected";
    const ghosting = conversationGhostingDecision(rows, now, ghostAfterDays);
    if (!terminal && ghosting.shouldGhost && ghosting.ghostedAt) {
      currentStatus = "ghosted";
      ghostedAt = ghosting.ghostedAt;
      events.push({
        emailId: null,
        status: "ghosted",
        eventAt: ghostedAt,
        source: "ghosting_rule",
        explanation: ghosting.reason,
      });
    }
    return {
      gmailAccountId: rows[0]?.gmail_account_id || "",
      groupingKey: identity.key,
      company: identity.company,
      role: identity.role,
      requisitionId: identity.requisitionId,
      currentStatus,
      firstActivityAt,
      lastActivityAt,
      ghostedAt,
      messages: rows.map((row) => ({ emailId: row.email_id, confidence: identity.confidence })),
      events,
    };
  });
}

export function lifecycleTransitions(
  applications: Array<{ current_status: ApplicationStatus; events: Array<{ status: ApplicationStatus; event_at: string }> }>,
): Array<{ source: ApplicationStatus; target: ApplicationStatus; count: number }> {
  const counts = new Map<string, number>();
  for (const application of applications) {
    const ordered = [...application.events].sort((left, right) => Date.parse(left.event_at) - Date.parse(right.event_at));
    const path: ApplicationStatus[] = [];
    for (const event of ordered) {
      const previous = path.at(-1);
      if (!previous) {
        path.push(event.status);
        continue;
      }
      if (previous === event.status || previous === "offer" || previous === "rejected" || previous === "ghosted") continue;
      if (event.status === "offer" || event.status === "rejected" || event.status === "ghosted" || STATUS_RANK[event.status] > STATUS_RANK[previous]) {
        path.push(event.status);
      }
    }
    const previous = path.at(-1);
    if (previous && previous !== application.current_status && (
      application.current_status === "offer" ||
      application.current_status === "rejected" ||
      application.current_status === "ghosted" ||
      STATUS_RANK[application.current_status] > STATUS_RANK[previous]
    )) path.push(application.current_status);
    for (let index = 1; index < path.length; index += 1) {
      const source = path[index - 1];
      const target = path[index];
      if (!source || !target || source === target) continue;
      const key = `${source}>${target}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [source, target] = key.split(">") as [ApplicationStatus, ApplicationStatus];
      return { source, target, count };
    })
    .sort((left, right) => right.count - left.count);
}
