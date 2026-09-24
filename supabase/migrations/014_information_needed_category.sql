begin;

-- Administrative application forms (EEO, WOTC, eligibility, profile, and
-- missing details) are a distinct decision from interviews and assessments.
alter table public.email_classifications
  drop constraint if exists email_classification_results_category_check,
  drop constraint if exists email_classification_results_category_decision_check,
  drop constraint if exists email_classifications_category_check,
  drop constraint if exists email_classifications_category_decision_check,
  add constraint email_classifications_category_check
    check (category is null or category in ('applied', 'outreach', 'reply_needed', 'information_needed', 'interview_assessment', 'offer', 'rejected', 'other')),
  add constraint email_classifications_category_decision_check
    check (category_decision is null or category_decision in ('applied', 'outreach', 'reply_needed', 'information_needed', 'interview_assessment', 'offer', 'rejected', 'other', 'uncertain'));

alter table public.emails
  drop constraint if exists emails_human_category_check,
  drop constraint if exists emails_llm_review_category_check,
  add constraint emails_human_category_check
    check (human_category is null or human_category in ('applied', 'outreach', 'reply_needed', 'information_needed', 'interview_assessment', 'offer', 'rejected', 'other', 'uncertain')),
  add constraint emails_llm_review_category_check
    check (llm_review_category is null or llm_review_category in ('applied', 'outreach', 'reply_needed', 'information_needed', 'interview_assessment', 'offer', 'rejected', 'other', 'uncertain'));

alter table public.applications
  drop constraint if exists applications_current_status_check,
  add constraint applications_current_status_check
    check (current_status in ('outreach', 'applied', 'reply_needed', 'information_needed', 'interview_assessment', 'offer', 'rejected', 'ghosted'));

alter table public.application_status_events
  drop constraint if exists application_status_events_status_check,
  add constraint application_status_events_status_check
    check (status in ('outreach', 'applied', 'reply_needed', 'information_needed', 'interview_assessment', 'offer', 'rejected', 'ghosted'));

comment on constraint email_classifications_category_check on public.email_classifications is
  'Jev v5 categories; information_needed is administrative data collection, not candidate evaluation.';

notify pgrst, 'reload schema';

commit;
