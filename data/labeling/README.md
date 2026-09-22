# Private email labeling workspace

Generate the 150-email review set from active Supabase emails:

```bash
uv run email-sample --count 150
```

All emails mentioning ATC are included first. The remaining slots are filled with a reproducible random sample. The private review pool is written to `generated/email-review-pool.json`, which is ignored by Git.

Start the local labeling UI:

```bash
uv run email-dashboard
```

Open `http://127.0.0.1:4173`. Labels autosave in the browser and merge into `generated/labeled-emails.json`. Use **Add emails** to append a duplicate-free batch. Balanced discovery favors uncommon reply/action, interview, assessment, offer, rejection, and outgoing signals; fully random sampling remains available. Export the accumulated labels as JSON or CSV whenever needed. Do not commit or share generated samples without redacting personal information.

Classification precedence for manual review:

- Use `interview_assessment` when the requested action is an interview, screening, assessment, take-home, case study, or scheduling step.
- Use `reply_needed` for recruiter questions, right-to-represent confirmations, requested documents, or requested information when no interview/assessment label applies.
- Use `outreach` for an outgoing message that initiates or follows up on a job-search conversation.
