import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applicationRelationshipPairKey,
  applicationGroupingIdentity,
  buildApplicationCandidates,
  conversationGhostingDecision,
  deterministicThreadRelationship,
  extractCompany,
  lifecycleTransitions,
  type ApplicationEmailEvidence,
} from "../lib/application-grouping.js";
import { unlinkedDeterministicApplicationIds } from "../lib/application-materializer.js";

function evidence(overrides: Partial<ApplicationEmailEvidence>): ApplicationEmailEvidence {
  return {
    email_id: "email-1",
    gmail_account_id: "account-1",
    gmail_thread_id: "thread-1",
    internal_date: "2026-08-01T12:00:00.000Z",
    direction: "incoming",
    from_name: "Acme Recruiting",
    from_email: "jobs@acme.com",
    subject: "Thank you for applying to Acme",
    effective_category: "applied",
    human_category: null,
    ...overrides,
  };
}

test("application identity extracts LinkedIn destination company", () => {
  const identity = applicationGroupingIdentity(evidence({
    from_name: "LinkedIn",
    from_email: "jobs-noreply@linkedin.com",
    subject: "Tirth, your application was sent to Example Labs",
  }));
  assert.equal(identity.company, "Example Labs");
  assert.match(identity.key, /^company:example-labs:/);
});

test("grouping combines related evidence and applies explainable ghosting", () => {
  const applications = buildApplicationCandidates([
    evidence({
      email_id: "email-1",
      gmail_thread_id: "thread-1",
      internal_date: "2026-08-01T12:00:00.000Z",
      direction: "outgoing",
      subject: "Application for Data Engineer at Acme - REQ-1234",
      effective_category: "outreach",
    }),
    evidence({
      email_id: "email-2",
      gmail_thread_id: "thread-1",
      internal_date: "2026-08-02T12:00:00.000Z",
      direction: "incoming",
      subject: "Update on Application for Data Engineer at Acme - REQ-1234",
      effective_category: "reply_needed",
    }),
    evidence({
      email_id: "email-3",
      gmail_thread_id: "thread-1",
      internal_date: "2026-08-03T12:00:00.000Z",
      direction: "outgoing",
      subject: "Re: Update on Application for Data Engineer at Acme - REQ-1234",
      effective_category: "outreach",
    }),
  ], { now: new Date("2026-09-22T12:00:00.000Z"), ghostAfterDays: 21 });

  assert.equal(applications.length, 1);
  assert.equal(applications[0]?.messages.length, 3);
  assert.equal(applications[0]?.currentStatus, "ghosted");
  assert.match(applications[0]?.events.at(-1)?.explanation || "", /Established 3-message conversation/);
});

test("old cold outreach remains outreach instead of becoming ghosted", () => {
  const applications = buildApplicationCandidates([
    evidence({
      email_id: "cold-outreach",
      gmail_thread_id: "cold-thread",
      direction: "outgoing",
      subject: "Data Engineer opportunity at Acme",
      effective_category: "outreach",
    }),
  ], { now: new Date("2026-09-22T12:00:00.000Z"), ghostAfterDays: 21 });
  assert.equal(applications[0]?.currentStatus, "outreach");
  assert.equal(applications[0]?.ghostedAt, null);
});

test("old application without a conversation remains applied", () => {
  const applications = buildApplicationCandidates([
    evidence({ email_id: "application-confirmation", effective_category: "applied" }),
  ], { now: new Date("2026-09-22T12:00:00.000Z"), ghostAfterDays: 21 });
  assert.equal(applications[0]?.currentStatus, "applied");
  assert.equal(applications[0]?.ghostedAt, null);
});

test("two-message exchange is not enough to infer ghosting", () => {
  const rows = [
    evidence({ email_id: "recruiter", direction: "incoming", effective_category: "reply_needed" }),
    evidence({
      email_id: "candidate",
      direction: "outgoing",
      internal_date: "2026-08-02T12:00:00.000Z",
      effective_category: "outreach",
    }),
  ];
  const decision = conversationGhostingDecision(rows, new Date("2026-09-22T12:00:00.000Z"), 21);
  assert.equal(decision.shouldGhost, false);
});

test("conversation awaiting the candidate remains reply needed", () => {
  const applications = buildApplicationCandidates([
    evidence({ email_id: "candidate-1", direction: "outgoing", effective_category: "outreach" }),
    evidence({ email_id: "recruiter-1", direction: "incoming", internal_date: "2026-08-02T12:00:00.000Z", effective_category: "reply_needed" }),
    evidence({ email_id: "recruiter-2", direction: "incoming", internal_date: "2026-08-03T12:00:00.000Z", effective_category: "reply_needed" }),
  ], { now: new Date("2026-09-22T12:00:00.000Z"), ghostAfterDays: 21 });
  assert.equal(applications[0]?.currentStatus, "reply_needed");
  assert.equal(applications[0]?.ghostedAt, null);
});

test("separate cold outreach threads do not merge by company and role", () => {
  const applications = buildApplicationCandidates([
    evidence({
      email_id: "outreach-one",
      gmail_thread_id: "cold-one",
      direction: "outgoing",
      subject: "Application for Data Engineer at Acme",
      effective_category: "outreach",
    }),
    evidence({
      email_id: "outreach-two",
      gmail_thread_id: "cold-two",
      direction: "outgoing",
      internal_date: "2026-08-02T12:00:00.000Z",
      subject: "Application for Data Engineer at Acme",
      effective_category: "outreach",
    }),
  ], { now: new Date("2026-08-03T12:00:00.000Z") });
  assert.equal(applications.length, 2);
});

test("incoming email and sent reply in the same Gmail thread stay in one application", () => {
  const applications = buildApplicationCandidates([
    evidence({
      email_id: "incoming-1",
      gmail_thread_id: "conversation-42",
      from_name: "Acme Recruiting",
      from_email: "recruiter@acme.com",
      subject: "Application for Data Engineer at Acme - REQ-1234",
      effective_category: "reply_needed",
    }),
    evidence({
      email_id: "sent-reply-1",
      gmail_thread_id: "conversation-42",
      internal_date: "2026-08-01T13:00:00.000Z",
      direction: "outgoing",
      from_name: "Tirth Shah",
      from_email: "tirth@example.com",
      subject: "Re: Application for Data Engineer at Acme - REQ-1234",
      effective_category: "outreach",
    }),
  ], { now: new Date("2026-08-02T12:00:00.000Z") });

  assert.equal(applications.length, 1);
  assert.deepEqual(
    applications[0]?.messages.map((message) => message.emailId).sort(),
    ["incoming-1", "sent-reply-1"],
  );
  assert.equal(applications[0]?.requisitionId, "REQ-1234");
});

test("thread continuity wins when a reply has different sender-derived identity", () => {
  const applications = buildApplicationCandidates([
    evidence({
      email_id: "recruiter-message",
      gmail_thread_id: "thread-shared",
      from_name: "Insight Global Recruiting",
      from_email: "recruiter@insightglobal.com",
      subject: "Junior AI Developer role at Verizon - REQ-7788",
      effective_category: "reply_needed",
    }),
    evidence({
      email_id: "candidate-reply",
      gmail_thread_id: "thread-shared",
      internal_date: "2026-08-01T13:00:00.000Z",
      direction: "outgoing",
      from_name: "Tirth Shah",
      from_email: "tirth@gmail.com",
      subject: "Re: Junior AI Developer role",
      effective_category: "outreach",
    }),
  ], { now: new Date("2026-08-02T12:00:00.000Z") });

  assert.equal(applications.length, 1);
  assert.equal(applications[0]?.messages.length, 2);
  assert.equal(applications[0]?.company, "Verizon");
});

test("outgoing replies do not treat the job seeker as the destination company", () => {
  const outgoing = evidence({
    direction: "outgoing",
    from_name: "Tirth Shah",
    from_email: "tirth@gmail.com",
    subject: "Re: Junior AI Developer role",
  });
  assert.equal(extractCompany(outgoing), null);
});

test("same Gmail thread can split job-board emails for different companies", () => {
  const solaris = evidence({
    email_id: "solaris-email",
    gmail_thread_id: "shared-job-board-thread",
    from_name: "Shared Job Board",
    from_email: "notifications@jobboard.example",
    subject: "Thank you for applying to Solaris",
  });
  const acme = evidence({
    email_id: "acme-email",
    gmail_thread_id: "shared-job-board-thread",
    internal_date: "2026-08-02T12:00:00.000Z",
    from_name: "Shared Job Board",
    from_email: "notifications@jobboard.example",
    subject: "Thank you for applying to Acme",
  });
  assert.equal(deterministicThreadRelationship(solaris, acme), "ambiguous");
  const decisions = new Map([[applicationRelationshipPairKey(solaris.email_id, acme.email_id), {
    sameApplication: false,
    probability: 0.03,
    source: "jev" as const,
  }]]);
  const applications = buildApplicationCandidates([solaris, acme], {
    now: new Date("2026-08-03T12:00:00.000Z"),
    relationshipDecisions: decisions,
  });
  assert.equal(applications.length, 2);
  assert.deepEqual(applications.map((application) => application.company).sort(), ["Acme", "Solaris"]);
});

test("Jev relationship yes can join ambiguous messages in one thread", () => {
  const first = evidence({
    email_id: "first-stage",
    gmail_thread_id: "ambiguous-thread",
    from_name: "Recruiting Platform",
    from_email: "updates@platform.example",
    subject: "Your application was received",
  });
  const second = evidence({
    email_id: "later-stage",
    gmail_thread_id: "ambiguous-thread",
    internal_date: "2026-08-02T12:00:00.000Z",
    from_name: "Hiring Operations",
    from_email: "updates@platform.example",
    subject: "Next step in the hiring process",
    effective_category: "interview_assessment",
  });
  const decisions = new Map([[applicationRelationshipPairKey(first.email_id, second.email_id), {
    sameApplication: true,
    probability: 0.91,
    source: "jev" as const,
  }]]);
  const applications = buildApplicationCandidates([first, second], {
    now: new Date("2026-08-03T12:00:00.000Z"),
    relationshipDecisions: decisions,
  });
  assert.equal(applications.length, 1);
  assert.equal(applications[0]?.messages.length, 2);
});

test("different requisition ids never merge even when Gmail thread ids match", () => {
  const applications = buildApplicationCandidates([
    evidence({ email_id: "req-one", gmail_thread_id: "reused-thread", subject: "Application for Engineer at Acme - REQ-1111" }),
    evidence({ email_id: "req-two", gmail_thread_id: "reused-thread", subject: "Application for Engineer at Acme - REQ-2222" }),
  ], { now: new Date("2026-08-03T12:00:00.000Z") });
  assert.equal(applications.length, 2);
  assert.notEqual(applications[0]?.groupingKey, applications[1]?.groupingKey);
});

test("a negative pair prevents transitive bridge merges inside a reused thread", () => {
  const first = evidence({
    email_id: "solaris",
    gmail_thread_id: "reused-platform-thread",
    from_name: "Shared Job Board",
    from_email: "notifications@jobboard.example",
    subject: "Thank you for applying to Solaris",
  });
  const bridge = evidence({
    email_id: "generic-update",
    gmail_thread_id: "reused-platform-thread",
    internal_date: "2026-08-02T12:00:00.000Z",
    from_name: "Hiring Platform",
    from_email: "updates@platform.example",
    subject: "Your application status changed",
  });
  const third = evidence({
    email_id: "acme",
    gmail_thread_id: "reused-platform-thread",
    internal_date: "2026-08-03T12:00:00.000Z",
    from_name: "Shared Job Board",
    from_email: "notifications@jobboard.example",
    subject: "Thank you for applying to Acme",
  });
  const decisions = new Map([
    [applicationRelationshipPairKey(first.email_id, bridge.email_id), {
      sameApplication: true, probability: 0.93, source: "jev" as const,
    }],
    [applicationRelationshipPairKey(bridge.email_id, third.email_id), {
      sameApplication: true, probability: 0.9, source: "jev" as const,
    }],
    [applicationRelationshipPairKey(first.email_id, third.email_id), {
      sameApplication: false, probability: 0.02, source: "jev" as const,
    }],
  ]);
  const applications = buildApplicationCandidates([first, bridge, third], {
    now: new Date("2026-08-04T12:00:00.000Z"),
    relationshipDecisions: decisions,
  });
  assert.equal(applications.length, 2);
  assert.equal(Math.max(...applications.map((application) => application.messages.length)), 2);
});

test("orphan cleanup removes only empty deterministic applications", () => {
  const orphaned = unlinkedDeterministicApplicationIds([
    { id: "linked-auto", grouping_source: "deterministic" },
    { id: "empty-auto", grouping_source: "deterministic" },
    { id: "empty-manual", grouping_source: "manual" },
  ], [
    { application_id: "linked-auto" },
  ]);
  assert.deepEqual(orphaned, ["empty-auto"]);
});

test("terminal and progressed statuses prevent ghosting", () => {
  const applications = buildApplicationCandidates([
    evidence({ email_id: "email-1", subject: "Application for Data Engineer at Acme - REQ-1234" }),
    evidence({
      email_id: "email-2",
      internal_date: "2026-08-08T12:00:00.000Z",
      subject: "Update on Application for Data Engineer at Acme - REQ-1234",
      effective_category: "rejected",
    }),
  ], { now: new Date("2026-09-22T12:00:00.000Z") });
  assert.equal(applications[0]?.currentStatus, "rejected");
  assert.equal(applications[0]?.ghostedAt, null);
});

test("lifecycle transitions collapse repeated statuses", () => {
  const transitions = lifecycleTransitions([{
    current_status: "offer",
    events: [
      { status: "applied", event_at: "2026-01-01T00:00:00Z" },
      { status: "applied", event_at: "2026-01-02T00:00:00Z" },
      { status: "interview_assessment", event_at: "2026-01-03T00:00:00Z" },
      { status: "offer", event_at: "2026-01-04T00:00:00Z" },
    ],
  }]);
  assert.deepEqual(transitions, [
    { source: "applied", target: "interview_assessment", count: 1 },
    { source: "interview_assessment", target: "offer", count: 1 },
  ]);
});

test("application lifecycle migration keeps the Phase 10 schema narrow and private", async () => {
  const migration = await readFile("supabase/migrations/006_application_lifecycle.sql", "utf8");
  assert.match(migration, /create table public\.applications/);
  assert.match(migration, /create table public\.application_messages/);
  assert.match(migration, /create table public\.application_status_events/);
  assert.match(migration, /create view public\.application_board/);
  assert.match(migration, /alter table public\.applications enable row level security/);
  assert.match(migration, /revoke all on public\.application_board from anon, authenticated/);
  assert.match(migration, /constraint application_messages_email_unique unique \(email_id\)/);
});
