# Private email labeling workspace

Generate the 150-email review set from active Supabase emails:

```bash
npm run sample:emails
```

All emails mentioning ATC are included first. The remaining slots are filled with a reproducible random sample. The private review pool is written to `generated/email-review-pool.json`, which is ignored by Git.

Start the local labeling UI:

```bash
npm run label:ui
```

Open `http://127.0.0.1:4173`. Labels autosave in the browser and merge into `generated/labeled-emails.json`. Use **Add emails** to append a duplicate-free batch. Balanced discovery favors uncommon reply/action, administrative-information, interview, assessment, offer, rejection, and outgoing signals; fully random sampling remains available. Export the accumulated labels as JSON or CSV whenever needed. Do not commit or share generated samples without redacting personal information.

Classification precedence for manual review:

- Use `information_needed` for administrative candidate-data forms or portals: EEO, WOTC, self-identification, demographics, work authorization, eligibility, profile completion, or missing application details.
- Use `interview_assessment` when the requested action is an interview, evaluative screening, skills/personality assessment, take-home, case study, or scheduling step. A generic questionnaire is not an assessment unless it evaluates the candidate.
- Use `other` for candidate-experience, application-experience, or interview-process feedback/satisfaction surveys. They ask for feedback about the process, not information about the candidate, and they do not evaluate the candidate.
- Use `reply_needed` when the job seeker must write an email/message response, including recruiter questions, right-to-represent confirmations, or requested documents sent by reply.
- Use `outreach` for an outgoing message that initiates or follows up on a job-search conversation.
