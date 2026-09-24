import { createHash } from "node:crypto";
import { choice, type ChoiceCriteria, type EntryType, type TypeSafeClient } from "@typesafe-ai/sdk";

export const COMPANY_RESOLUTION_APPLICATION_STATUSES = new Set([
  "outreach",
  "applied",
  "reply_needed",
  "information_needed",
  "interview_assessment",
  "offer",
  "rejected",
  "ghosted",
  "uncertain",
]);

export function isCompanyResolutionApplicationStatus(status: string): boolean {
  return COMPANY_RESOLUTION_APPLICATION_STATUSES.has(status);
}

export interface CompanyResolutionMessage {
  id: string;
  internal_date: string;
  direction: string;
  from_name: string | null;
  from_email: string | null;
  to_recipients: unknown;
  subject: string;
  snippet: string;
  body_text: string;
}

export interface CompanyResolutionContext {
  applicationId: string;
  gmailAccountId: string;
  currentCompany: string | null;
  currentRole: string | null;
  requisitionId: string | null;
  messages: CompanyResolutionMessage[];
}

export interface CompanyCandidate {
  id: string;
  name: string;
  sources: string[];
  evidence: string[];
  platformHint: boolean;
}

export interface CompanyChoiceResult {
  candidateId: string;
  name: string | null;
  confidence: number;
  topProbability: number;
  probabilities: Record<string, number>;
}

export interface JevCompanyResolution {
  contextHash: string;
  candidates: CompanyCandidate[];
  titleCandidates: CompanyCandidate[];
  employer: CompanyChoiceResult;
  title: CompanyChoiceResult;
  agency: CompanyChoiceResult;
  platform: CompanyChoiceResult;
  companyNeedsLlmReview: boolean;
  titleNeedsLlmReview: boolean;
  needsLlmReview: boolean;
  model: string;
  inputTokens: number;
}

const PLATFORM_DOMAINS: Record<string, string> = {
  "myworkday.com": "Workday",
  "otp.workday.com": "Workday",
  "greenhouse-mail.io": "Greenhouse",
  "boards.greenhouse.io": "Greenhouse",
  "hire.lever.co": "Lever",
  "ashbyhq.com": "Ashby",
  "jobvite.com": "Jobvite",
  "icims.com": "iCIMS",
  "smartrecruiters.com": "SmartRecruiters",
  "ats.rippling.com": "Rippling ATS",
  "paylocity.com": "Paylocity",
  "dayforcehcm.com": "Dayforce",
};

const PERSONAL_DOMAINS = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"]);
const COMPANY_PHRASES = [
  /(?:applying|application|interest)(?:\s+(?:for|with|at|to|in))?\s+(?:the\s+[^\n.!]{2,100}?\s+(?:position|role)\s+at\s+)?([A-Z][A-Za-z0-9&'., -]{1,80})/g,
  /(?:position|role|opportunity|job)\s+(?:with|at)\s+([A-Z][A-Za-z0-9&'., -]{1,80})/g,
  /(?:welcome to|joining)\s+([A-Z][A-Za-z0-9&'., -]{1,80})/g,
];
const TITLE_PHRASES = [
  /(?:application|applying)(?:\s+(?:for|to))\s+(?:the\s+)?(?:position|role)?\s*(?:of\s+)?([^\n.!|]{2,140}?)(?=\s+(?:at|with)\s+[A-Z]|[.!|]|$)/gi,
  /(?:position|role|job title)\s*(?:of|is|:|-)?\s*([^\n.!|]{2,140}?)(?=\s+(?:at|with)\s+[A-Z]|[.!|]|$)/gi,
  /(?:next steps?|interview|assessment)\s+(?:for|in)\s+(?:the\s+)?([^\n.!|]{2,140}?)(?=\s+(?:at|with)\s+[A-Z]|[.!|]|$)/gi,
];

function clean(value: unknown): string {
  return String(value || "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, "")
    .trim();
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function registeredDomain(host: string): string {
  const pieces = host.split(".");
  return pieces.length >= 2 ? pieces.slice(-2).join(".") : host;
}

function nameFromDomain(domain: string): string {
  const root = domain.split(".")[0] || domain;
  return root.split(/[-_]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function platformForDomain(domain: string): string | null {
  for (const [known, platform] of Object.entries(PLATFORM_DOMAINS)) {
    if (domain === known || domain.endsWith(`.${known}`)) return platform;
  }
  return null;
}

function candidateEvidence(value: string): string {
  return clean(value).slice(0, 220);
}

function recipientIdentities(value: unknown): Array<{ name: string; email: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((recipient) => {
    if (typeof recipient === "string") {
      const email = recipient.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
      const name = clean(recipient.replace(email, "").replace(/[<>\"']/g, ""));
      return email || name ? [{ name, email }] : [];
    }
    if (!recipient || typeof recipient !== "object") return [];
    const record = recipient as Record<string, unknown>;
    const email = clean(record.email || record.address || record.mailbox).toLowerCase();
    const name = clean(record.name || record.display_name || record.displayName);
    return email || name ? [{ name, email }] : [];
  });
}

export function buildCompanyCandidates(context: CompanyResolutionContext): CompanyCandidate[] {
  const byName = new Map<string, Omit<CompanyCandidate, "id">>();
  const add = (nameValue: unknown, source: string, evidenceValue: string, platformHint = false): void => {
    const name = clean(nameValue)
      .replace(/\s+(?:careers?|recruiting|recruitment|talent acquisition|hiring team|notifications?|no[ -]?reply)$/i, "")
      .trim();
    const key = normalized(name);
    if (!key || name.length < 2 || name.length > 100) return;
    if (/^(?:team|human resources|hr|recruiter|recruiting|hiring|careers?|notification|no reply|do not reply)$/i.test(name)) return;
    const existing = byName.get(key);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      const evidence = candidateEvidence(evidenceValue);
      if (evidence && !existing.evidence.includes(evidence) && existing.evidence.length < 5) existing.evidence.push(evidence);
      existing.platformHint ||= platformHint;
      return;
    }
    byName.set(key, {
      name,
      sources: [source],
      evidence: [candidateEvidence(evidenceValue)].filter(Boolean),
      platformHint,
    });
  };

  if (context.currentCompany) add(context.currentCompany, "current_database_value", context.currentCompany);
  for (const message of context.messages) {
    const senderDomain = String(message.from_email || "").toLowerCase().split("@")[1]?.replace(/^mail\./, "") || "";
    const senderPlatform = platformForDomain(senderDomain);
    if (message.from_name) add(message.from_name, "sender_name", `${message.from_name} <${message.from_email || ""}>`, Boolean(senderPlatform));
    if (senderPlatform) add(senderPlatform, "sender_platform_domain", senderDomain, true);
    else if (senderDomain && !PERSONAL_DOMAINS.has(senderDomain)) add(nameFromDomain(registeredDomain(senderDomain)), "sender_domain", senderDomain);

    // Outgoing replies often carry the strongest identity evidence in the recipient,
    // while incoming ATS mail can hide the employer behind a generic sender.
    for (const recipient of recipientIdentities(message.to_recipients)) {
      const recipientDomain = recipient.email.split("@")[1]?.replace(/^mail\./, "") || "";
      const recipientPlatform = platformForDomain(recipientDomain);
      if (recipient.name) add(recipient.name, "recipient_name", `${recipient.name} <${recipient.email}>`, Boolean(recipientPlatform));
      if (recipientPlatform) add(recipientPlatform, "recipient_platform_domain", recipientDomain, true);
      else if (recipientDomain && !PERSONAL_DOMAINS.has(recipientDomain)) {
        add(nameFromDomain(registeredDomain(recipientDomain)), "recipient_domain", recipientDomain);
      }
    }

    const text = `${message.subject}\n${message.body_text}`.slice(0, 40_000);
    for (const pattern of COMPANY_PHRASES) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const value = clean(match[1]).split(/(?:\s{2,}|\n|,\s+(?:and|but|for|where|which)\b)/i)[0];
        if (value) add(value, "message_phrase", match[0]);
      }
    }
    for (const rawUrl of text.match(/https?:\/\/[^\s<>"')]+/gi) || []) {
      const host = hostname(rawUrl);
      if (!host) continue;
      const platform = platformForDomain(host);
      if (platform) add(platform, "link_platform_domain", host, true);
      else {
        const domain = registeredDomain(host);
        if (!PERSONAL_DOMAINS.has(domain)) add(nameFromDomain(domain), "link_domain", host);
      }
    }
    const signatureLines = message.body_text.split(/\r?\n/).slice(-20);
    for (const line of signatureLines) {
      const value = clean(line);
      if (value.length > 100) continue;
      if (/\b(?:inc\.?|llc|ltd\.?|corp(?:oration)?\.?|company|consulting|technologies|solutions|group|partners|health|energy|bank)\b/i.test(value)) {
        add(value, "signature_line", value);
      }
    }
  }

  return [...byName.values()]
    .sort((left, right) => {
      const sourceScore = (candidate: Omit<CompanyCandidate, "id">) =>
        candidate.sources.includes("message_phrase") ? 5
          : candidate.sources.includes("signature_line") ? 4
            : candidate.sources.includes("link_domain") ? 3
              : candidate.sources.includes("current_database_value") ? 2
                : 1;
      return sourceScore(right) - sourceScore(left) || right.sources.length - left.sources.length;
    })
    .slice(0, 20)
    .map((candidate, index) => ({ id: `candidate_${index + 1}`, ...candidate }));
}

export function buildTitleCandidates(context: CompanyResolutionContext): CompanyCandidate[] {
  const byName = new Map<string, Omit<CompanyCandidate, "id">>();
  const add = (value: unknown, source: string, evidenceValue: string): void => {
    const name = clean(value)
      .replace(/^(?:the\s+)?(?:position|role|job)\s+(?:of\s+)?/i, "")
      .replace(/\s+(?:position|role)$/i, "")
      .trim();
    const key = normalized(name);
    if (!key || name.length < 3 || name.length > 140) return;
    if (/^(?:application|employment|opportunity|job|position|role|next steps?|interview|assessment)$/i.test(name)) return;
    const existing = byName.get(key);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      const evidence = candidateEvidence(evidenceValue);
      if (evidence && !existing.evidence.includes(evidence) && existing.evidence.length < 5) existing.evidence.push(evidence);
      return;
    }
    byName.set(key, {
      name,
      sources: [source],
      evidence: [candidateEvidence(evidenceValue)].filter(Boolean),
      platformHint: false,
    });
  };

  if (context.currentRole) add(context.currentRole, "current_database_value", context.currentRole);
  for (const message of context.messages) {
    const text = `${message.subject}\n${message.body_text}`.slice(0, 40_000);
    for (const pattern of TITLE_PHRASES) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const value = clean(match[1]).split(/(?:\s{2,}|\n|,\s+(?:and|but|for|where|which)\b)/i)[0];
        if (value) add(value, "message_phrase", match[0]);
      }
    }
  }

  return [...byName.values()]
    .sort((left, right) => {
      const sourceScore = (candidate: Omit<CompanyCandidate, "id">) =>
        candidate.sources.includes("message_phrase") ? 2 : 1;
      return sourceScore(right) - sourceScore(left) || right.sources.length - left.sources.length;
    })
    .slice(0, 16)
    .map((candidate, index) => ({ id: `title_candidate_${index + 1}`, ...candidate }));
}

export function companyResolutionContextHash(
  context: CompanyResolutionContext,
  candidates: CompanyCandidate[],
  titleCandidates: CompanyCandidate[] = buildTitleCandidates(context),
): string {
  return createHash("sha256").update(JSON.stringify({
    application_id: context.applicationId,
    current_company: context.currentCompany,
    current_role: context.currentRole,
    requisition_id: context.requisitionId,
    messages: context.messages.map((message) => ({
      id: message.id,
      date: message.internal_date,
      subject: message.subject,
      sender: [message.from_name, message.from_email],
      recipients: message.to_recipients,
      body: message.body_text,
    })),
    candidates,
    title_candidates: titleCandidates,
  })).digest("hex");
}

export function buildCompanyResolutionState(
  context: CompanyResolutionContext,
  candidates: CompanyCandidate[],
  titleCandidates: CompanyCandidate[] = buildTitleCandidates(context),
): EntryType {
  let remaining = 36_000;
  const messages = [...context.messages]
    .sort((left, right) => Date.parse(left.internal_date) - Date.parse(right.internal_date))
    .map((message) => {
      const body = message.body_text.slice(0, Math.max(0, Math.min(12_000, remaining)));
      remaining -= body.length;
      return {
        direction: message.direction,
        sender_name: message.from_name || "",
        sender_email: message.from_email || "",
        recipients: JSON.stringify(message.to_recipients || []),
        subject: message.subject,
        snippet: message.snippet,
        body,
        date: message.internal_date,
      };
    });
  return {
    application: {
      current_company: context.currentCompany || "",
      current_role: context.currentRole || "",
      requisition_id: context.requisitionId || "",
    },
    company_candidates: candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      sources: candidate.sources,
      evidence: candidate.evidence,
      platform_hint: candidate.platformHint,
    })),
    title_candidates: titleCandidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      sources: candidate.sources,
      evidence: candidate.evidence,
    })),
    messages,
  };
}

function candidateCriteria(candidates: CompanyCandidate[]): ChoiceCriteria {
  return Object.fromEntries([
    ...candidates.map((candidate) => [candidate.id, {
      name: candidate.name,
      observed_in: candidate.sources,
      evidence: candidate.evidence,
    }]),
    ["none", {
      meaning: "None of the supplied candidates is supported for this identity.",
      rule: "Choose this rather than guessing from an unrelated sender, person, recruiting platform, or ambiguous abbreviation.",
    }],
  ]);
}

function resolutionQuestions(candidates: CompanyCandidate[], titleCandidates: CompanyCandidate[]) {
  const companyCriteria = candidateCriteria(candidates);
  const titleCriteria = candidateCriteria(titleCandidates);
  return {
    employer: choice({
      task: "Which candidate is the actual hiring employer or end client for this specific job application?",
      rules: [
        "Use all messages and evidence together.",
        "Do not select a recruiter person, staffing agency, or ATS platform when a separate end employer is supported.",
        "If the evidence does not support any candidate as the employer, choose none.",
      ],
    }, companyCriteria),
    title: choice({
      task: "Which candidate is the specific job title or position for this application?",
      rules: [
        "Use evidence across all connected messages, including subject lines and body text.",
        "Choose a concrete position title, not a company, department, generic word such as job, or recruiting stage.",
        "If no supplied title candidate is supported, choose none.",
      ],
    }, titleCriteria),
    agency: choice({
      task: "Which candidate is the recruiting or staffing agency representing the candidate for this opportunity?",
      rules: [
        "An agency is different from the hiring employer and from the software platform.",
        "Choose none when no recruiting or staffing agency is supported.",
      ],
    }, companyCriteria),
    platform: choice({
      task: "Which candidate is only the ATS, job board, or recruiting software platform carrying the message?",
      rules: [
        "Examples include Workday, Greenhouse, Lever, iCIMS, SmartRecruiters, and similar systems.",
        "Do not select the employer or staffing agency as the platform.",
        "Choose none when no platform candidate is supported.",
      ],
    }, companyCriteria),
  };
}

function parsedChoice(
  answer: { choice: string; confidence: number; probabilities: Record<string, number> },
  candidates: CompanyCandidate[],
): CompanyChoiceResult {
  const candidate = candidates.find((item) => item.id === answer.choice);
  return {
    candidateId: answer.choice,
    name: candidate?.name || null,
    confidence: answer.confidence,
    topProbability: Math.max(...Object.values(answer.probabilities)),
    probabilities: answer.probabilities,
  };
}

export async function resolveApplicationCompanyWithJev(
  client: TypeSafeClient,
  context: CompanyResolutionContext,
  options: {
    model: string;
    minimumEmployerProbability?: number;
    minimumEmployerConfidence?: number;
    minimumTitleProbability?: number;
    minimumTitleConfidence?: number;
  },
): Promise<JevCompanyResolution> {
  const candidates = buildCompanyCandidates(context);
  const titleCandidates = buildTitleCandidates(context);
  const contextHash = companyResolutionContextHash(context, candidates, titleCandidates);
  if (!candidates.length && !titleCandidates.length) {
    const none = { candidateId: "none", name: null, confidence: 1, topProbability: 1, probabilities: { none: 1 } };
    return {
      contextHash,
      candidates,
      titleCandidates,
      employer: none,
      title: none,
      agency: none,
      platform: none,
      companyNeedsLlmReview: true,
      titleNeedsLlmReview: true,
      needsLlmReview: true,
      model: options.model,
      inputTokens: 0,
    };
  }
  const response = await client.systemOne({
    model: options.model,
    state: buildCompanyResolutionState(context, candidates, titleCandidates),
    questions: resolutionQuestions(candidates, titleCandidates),
  });
  const employer = parsedChoice(response.answers.employer, candidates);
  const title = parsedChoice(response.answers.title, titleCandidates);
  const agency = parsedChoice(response.answers.agency, candidates);
  const platform = parsedChoice(response.answers.platform, candidates);
  const companyNeedsLlmReview = employer.candidateId === "none"
    || employer.topProbability < (options.minimumEmployerProbability ?? 0.8)
    || employer.confidence < (options.minimumEmployerConfidence ?? 0.65);
  const titleNeedsLlmReview = title.candidateId === "none"
    || title.topProbability < (options.minimumTitleProbability ?? 0.8)
    || title.confidence < (options.minimumTitleConfidence ?? 0.65);
  return {
    contextHash,
    candidates,
    titleCandidates,
    employer,
    title,
    agency,
    platform,
    companyNeedsLlmReview,
    titleNeedsLlmReview,
    needsLlmReview: companyNeedsLlmReview || titleNeedsLlmReview,
    model: response.model,
    inputTokens: response.usage.input_tokens,
  };
}
