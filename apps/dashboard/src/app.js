const app = document.querySelector("#app");
const errorState = document.querySelector("#errorState");
const errorMessage = document.querySelector("#errorMessage");
const emailList = document.querySelector("#emailList");
const categoryButtons = document.querySelector("#categoryButtons");
const categoryCounts = document.querySelector("#categoryCounts");
const searchInput = document.querySelector("#searchInput");
const reviewNotes = document.querySelector("#reviewNotes");
const resampleDialog = document.querySelector("#resampleDialog");
const confirmResample = document.querySelector("#confirmResample");
const resampleStatus = document.querySelector("#resampleStatus");
const showReview = document.querySelector("#showReview");
const showBenchmark = document.querySelector("#showBenchmark");
const viewTabs = [...document.querySelectorAll("[data-view]")];
const reviewSidebar = document.querySelector("#reviewSidebar");
const reviewReader = document.querySelector("#reviewReader");
const reviewClassifier = document.querySelector("#reviewClassifier");
const benchmarkView = document.querySelector("#benchmarkView");
const benchmarkEmpty = document.querySelector("#benchmarkEmpty");
const benchmarkContent = document.querySelector("#benchmarkContent");
const benchmarkCards = document.querySelector("#benchmarkCards");
const benchmarkRows = document.querySelector("#benchmarkRows");
const benchmarkFilter = document.querySelector("#benchmarkFilter");
const benchmarkScope = document.querySelector("#benchmarkScope");
const commandView = document.querySelector("#commandView");
const commandForm = document.querySelector("#commandForm");
const commandScope = document.querySelector("#commandScope");
const commandMaximum = document.querySelector("#commandMaximum");
const commandAfter = document.querySelector("#commandAfter");
const commandBefore = document.querySelector("#commandBefore");
const commandThreshold = document.querySelector("#commandThreshold");
const commandConcurrency = document.querySelector("#commandConcurrency");
const commandBatchSize = document.querySelector("#commandBatchSize");
const commandPreview = document.querySelector("#commandPreview");
const commandStatus = document.querySelector("#commandStatus");
const commandRuns = document.querySelector("#commandRuns");
const commandRunCount = document.querySelector("#commandRunCount");
const placeholderView = document.querySelector("#placeholderView");
const placeholderPhase = document.querySelector("#placeholderPhase");
const placeholderEyebrow = document.querySelector("#placeholderEyebrow");
const placeholderTitle = document.querySelector("#placeholderTitle");
const placeholderDescription = document.querySelector("#placeholderDescription");
const placeholderFeatures = document.querySelector("#placeholderFeatures");
const topActions = document.querySelector(".top-actions");
const progressBlock = document.querySelector(".progress-block");

let dataset;
let storageKey;
let state = { currentEmailId: null, labels: {} };
let activeFilter = "all";
let searchTerm = "";
let noteSaveTimer;
let benchmarkReport = null;
let commandPollTimer;

const workspaceViews = {
  command: {
    phase: "Phase 6",
    eyebrow: "Operations",
    title: "Command Center",
    description: "Configure, preview, launch, and monitor durable Gmail and Jev processing runs.",
    features: ["Count-only run preview", "Concurrency and confidence controls", "Resumable progress and failure recovery"],
  },
  board: {
    phase: "Phase 9",
    eyebrow: "Classified mailbox",
    title: "Email Board",
    description: "Explore the latest accepted email classifications and correct them with a complete audit trail.",
    features: ["Category columns", "Evidence and Gmail deep links", "Human-confirmed correction workflow"],
  },
  analytics: {
    phase: "Phase 9",
    eyebrow: "Measured decisions",
    title: "Analytics",
    description: "Track categories, actions, uncertainty, throughput, and benchmark quality by result set.",
    features: ["Category and action trends", "Accuracy and confidence views", "Run throughput and usage"],
  },
  assistant: {
    phase: "Later roadmap",
    eyebrow: "Read-only intelligence",
    title: "AI Assistant",
    description: "Ask evidence-backed questions about applications and email activity after application grouping is reliable.",
    features: ["Structured queries for counts", "Semantic retrieval for email evidence", "Source citations with no automatic mutations"],
  },
};

const categoryDescriptions = {
  applied: "Application received",
  outreach: "Outgoing message that initiates or follows up on a job conversation",
  reply_needed: "Recruiter question, requested information, or right-to-represent response",
  interview_assessment: "Interview, test, or assessment",
  offer: "Offer or offer next step",
  rejected: "Explicit rejection",
  other: "Not part of the defined job-email categories",
  uncertain: "Not enough evidence",
};

function displayCategory(category) {
  return category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayPercent(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
}

function switchView(view) {
  const benchmarkActive = view === "benchmark";
  const reviewActive = view === "review";
  const commandActive = view === "command";
  const placeholderActive = view in workspaceViews && !commandActive;
  app.classList.toggle("benchmark-mode", !reviewActive);
  reviewSidebar.hidden = !reviewActive;
  reviewReader.hidden = !reviewActive;
  reviewClassifier.hidden = !reviewActive;
  benchmarkView.hidden = !benchmarkActive;
  commandView.hidden = !commandActive;
  placeholderView.hidden = !placeholderActive;
  topActions.hidden = !reviewActive;
  progressBlock.hidden = !reviewActive;
  for (const tab of viewTabs) {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  if (placeholderActive) renderPlaceholder(workspaceViews[view]);
  if (benchmarkActive) void loadBenchmark();
  window.clearInterval(commandPollTimer);
  if (commandActive) {
    void loadCommandRuns();
    commandPollTimer = window.setInterval(() => void loadCommandRuns(), 5000);
  }
}

function navigateToView(view) {
  const safeView = view === "review" || view === "benchmark" || view in workspaceViews ? view : "review";
  if (window.location.hash !== `#${safeView}`) window.location.hash = safeView;
  else switchView(safeView);
}

function renderPlaceholder(view) {
  placeholderPhase.textContent = view.phase;
  placeholderEyebrow.textContent = view.eyebrow;
  placeholderTitle.textContent = view.title;
  placeholderDescription.textContent = view.description;
  placeholderFeatures.replaceChildren();
  for (const feature of view.features) {
    const item = document.createElement("div");
    item.className = "placeholder-feature";
    item.textContent = feature;
    placeholderFeatures.append(item);
  }
}

function appendMetricCard(label, value, detail) {
  const card = document.createElement("article");
  card.className = "metric-card";
  const name = document.createElement("span");
  name.textContent = label;
  const result = document.createElement("strong");
  result.textContent = value;
  const description = document.createElement("small");
  description.textContent = detail;
  card.append(name, result, description);
  benchmarkCards.append(card);
}

function renderCategoryPerformance(report) {
  const container = document.querySelector("#categoryPerformance");
  container.replaceChildren();
  for (const [category, performance] of Object.entries(report.per_category || {})) {
    const row = document.createElement("div");
    row.className = "performance-row";
    const name = document.createElement("strong");
    name.textContent = displayCategory(category);
    const bar = document.createElement("div");
    bar.className = "performance-bar";
    const fill = document.createElement("span");
    fill.style.width = performance.accuracy === null ? "0" : `${performance.accuracy * 100}%`;
    bar.append(fill);
    const value = document.createElement("span");
    value.className = "performance-value";
    value.textContent = performance.count
      ? `${performance.correct}/${performance.count}`
      : "No test examples";
    row.append(name, bar, value);
    container.append(row);
  }
}

function benchmarkStatus(row) {
  if (row.decision === "uncertain") return "uncertain";
  return row.decision === row.expected ? "correct" : "incorrect";
}

function detailCell(label, value) {
  const cell = document.createElement("span");
  cell.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  cell.append(strong);
  return cell;
}

function formatRecipients(recipients) {
  if (!Array.isArray(recipients) || recipients.length === 0) return "Not available";
  return recipients
    .map((recipient) => recipient.raw || [recipient.name, recipient.email].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(", ");
}

function createEmailPreview(resultRow) {
  const email = dataset.emails.find((candidate) => candidate.email_id === resultRow.email_id);
  const preview = document.createElement("section");
  preview.className = "benchmark-email-preview";
  if (!email) {
    preview.textContent = "The source email is not present in the current local review pool.";
    return preview;
  }

  const header = document.createElement("header");
  header.className = "benchmark-email-header";
  const subject = document.createElement("h4");
  subject.textContent = email.subject || "(no subject)";
  const meta = document.createElement("div");
  meta.className = "benchmark-email-meta";
  const fields = [
    ["From", [email.from_name, email.from_email].filter(Boolean).join(" · ") || "Unknown"],
    ["To", formatRecipients(email.to_recipients)],
    ["Date", email.internal_date ? new Date(email.internal_date).toLocaleString() : "Unknown"],
    ["Direction", displayCategory(email.direction || "unknown")],
  ];
  for (const [label, value] of fields) {
    const field = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = `${label}:`;
    field.append(name, document.createTextNode(value));
    meta.append(field);
  }
  header.append(subject, meta);

  const snippet = document.createElement("p");
  snippet.className = "benchmark-email-snippet";
  snippet.textContent = email.snippet || "No snippet available.";
  const body = document.createElement("pre");
  body.className = "benchmark-email-body";
  body.textContent = email.body_text || "No plain-text body available.";
  const gmailLink = document.createElement("a");
  gmailLink.className = "benchmark-email-link";
  gmailLink.href = `https://mail.google.com/mail/u/0/#all/${email.gmail_message_id}`;
  gmailLink.target = "_blank";
  gmailLink.rel = "noreferrer";
  gmailLink.textContent = "Open original in Gmail ↗";
  gmailLink.addEventListener("click", (event) => event.stopPropagation());
  preview.append(header, snippet, body, gmailLink);
  return preview;
}

function renderBenchmarkRows() {
  benchmarkRows.replaceChildren();
  if (!benchmarkReport) return;
  const filter = benchmarkFilter.value;
  const rows = benchmarkReport.results.filter((row) => filter === "all" || benchmarkStatus(row) === filter);
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "benchmark-row-empty";
    empty.textContent = "No evaluation emails match this filter.";
    benchmarkRows.append(empty);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("article");
    item.className = "benchmark-row";
    item.tabIndex = 0;
    item.setAttribute("aria-expanded", "false");
    const subject = document.createElement("div");
    subject.className = "benchmark-subject";
    const title = document.createElement("strong");
    title.textContent = row.subject || "(no subject)";
    const sender = document.createElement("span");
    sender.textContent = [row.sender, row.direction].filter(Boolean).join(" · ");
    subject.append(title, sender);
    const expected = document.createElement("span");
    expected.className = "result-label";
    expected.textContent = `Human: ${displayCategory(row.expected)}`;
    const predicted = document.createElement("span");
    const status = benchmarkStatus(row);
    predicted.className = `result-label ${status}`;
    predicted.textContent = `Jev: ${displayCategory(row.decision)}`;
    const detail = document.createElement("div");
    detail.className = "benchmark-detail";
    detail.hidden = true;
    detail.append(
      detailCell("Top probability", displayPercent(row.top_probability)),
      detailCell("Next action · unscored", displayCategory(row.action.choice)),
      detailCell("Urgency · unscored", `${Number(row.urgency.score).toFixed(2)} / 4.00`),
      detailCell("Draft needed · unscored", `${row.draft_reply.should_draft ? "Yes" : "No"} · ${displayPercent(row.draft_reply.probability)}`),
      createEmailPreview(row),
    );
    const toggle = () => {
      detail.hidden = !detail.hidden;
      item.setAttribute("aria-expanded", String(!detail.hidden));
    };
    item.addEventListener("click", toggle);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
    item.append(subject, expected, predicted, detail);
    benchmarkRows.append(item);
  }
}

function renderBenchmark(report) {
  benchmarkReport = report;
  benchmarkEmpty.hidden = true;
  benchmarkContent.hidden = false;
  benchmarkCards.replaceChildren();
  appendMetricCard("Raw category accuracy", displayPercent(report.metrics.raw_accuracy), "Top email category vs human label");
  appendMetricCard("Automatic coverage", displayPercent(report.metrics.automatic_coverage), "Above the confidence threshold");
  appendMetricCard("Automatic accuracy", displayPercent(report.metrics.automatic_accuracy), "Accuracy after uncertain cases are held out");
  appendMetricCard("Evaluation emails", String(report.metrics.examples), report.evaluation_scope || `${report.metrics.total_input_tokens} input tokens`);
  const returnedModels = Array.isArray(report.model_returned) ? report.model_returned.join(", ") : report.model_returned;
  document.querySelector("#benchmarkModel").textContent = `${report.classifier_version} · ${returnedModels || report.model_requested}`;
  renderCategoryPerformance(report);
  renderBenchmarkRows();
}

async function loadBenchmark() {
  benchmarkEmpty.hidden = false;
  benchmarkContent.hidden = true;
  benchmarkEmpty.textContent = "Loading benchmark results…";
  try {
    const response = await fetch(`/api/benchmark?scope=${benchmarkScope.value}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Benchmark request failed with status ${response.status}`);
    if (payload.status === "complete") {
      renderBenchmark(payload.report);
      return;
    }
    benchmarkReport = null;
    benchmarkEmpty.replaceChildren();
    const message = document.createElement("p");
    const statusMessage = payload.status === "stale"
      ? `The saved result belongs to ${payload.result_classifier_version}, not the current ${payload.current_classifier_version}.`
      : `${payload.evaluation_count} held-out emails are ready.`;
    message.textContent = `${statusMessage} ${payload.api_key_configured ? "Run the exact current configuration now." : "Add TYPESAFE_API_KEY to .env first."}`;
    const command = document.createElement("code");
    command.textContent = payload.command;
    benchmarkEmpty.append(message, command);
  } catch (error) {
    benchmarkEmpty.textContent = error instanceof Error ? error.message : String(error);
  }
}

function commandPayload() {
  const maximum = commandMaximum.value.trim();
  return {
    scope: commandScope.value,
    maximum: maximum ? Number(maximum) : null,
    after: commandAfter.value || null,
    before: commandBefore.value ? `${commandBefore.value}T23:59:59.999Z` : null,
    minimum_top_probability: Number(commandThreshold.value),
    concurrency: Number(commandConcurrency.value),
    batch_size: Number(commandBatchSize.value),
  };
}

async function previewCommand() {
  commandStatus.textContent = "Calculating selected email count…";
  commandStatus.classList.remove("error");
  try {
    const payload = commandPayload();
    const query = new URLSearchParams({
      scope: payload.scope,
      batch_size: String(payload.batch_size),
    });
    if (payload.maximum) query.set("maximum", String(payload.maximum));
    if (payload.after) query.set("after", payload.after);
    if (payload.before) query.set("before", payload.before);
    const response = await fetch(`/api/command/preview?${query}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Preview failed");
    commandPreview.textContent = `${result.selected_count} selected · ${result.batch_count} batches · ${result.available_count} available · ${result.previously_classified_count} previously classified.`;
    commandStatus.textContent = "Preview ready. Starting a run will freeze these email IDs.";
  } catch (error) {
    commandStatus.textContent = error instanceof Error ? error.message : String(error);
    commandStatus.classList.add("error");
  }
}

function runTiming(run) {
  if (!run.started_at) return "Not started";
  const end = run.finished_at ? new Date(run.finished_at).getTime() : Date.now();
  const seconds = Math.max(1, (end - new Date(run.started_at).getTime()) / 1000);
  const rate = (Number(run.processed_count || 0) / seconds) * 60;
  const remaining = Math.max(0, Number(run.total_count || 0) - Number(run.processed_count || 0));
  const eta = rate > 0 && remaining > 0 ? `${Math.ceil(remaining / rate)}m ETA` : "—";
  return `${rate.toFixed(1)}/min · ${eta}`;
}

function renderCommandRuns(runs) {
  commandRuns.replaceChildren();
  commandRunCount.textContent = `${runs.length} recent`;
  if (!runs.length) {
    commandRuns.textContent = "No classification runs yet.";
    return;
  }
  for (const run of runs) {
    const item = document.createElement("article");
    item.className = "command-run";
    const title = document.createElement("strong");
    title.textContent = `${run.run_kind || "production"} · ${run.status}`;
    const date = document.createElement("small");
    date.textContent = run.created_at ? new Date(run.created_at).toLocaleString() : "";
    const counts = document.createElement("small");
    counts.textContent = `${run.processed_count || 0}/${run.total_count || 0} processed · ${run.succeeded_count || 0} succeeded · ${run.failed_count || 0} failed · ${run.uncertain_count || 0} uncertain`;
    const timing = document.createElement("small");
    timing.textContent = `${run.classifier_version || "Jev"} · ${runTiming(run)}`;
    const progress = document.createElement("div");
    progress.className = "run-progress";
    const fill = document.createElement("span");
    fill.style.width = `${Number(run.progress_percent || 0)}%`;
    progress.append(fill);
    item.append(title, date, counts, timing, progress);
    if (run.error_message) {
      const error = document.createElement("small");
      error.className = "error";
      error.textContent = run.error_message;
      item.append(error);
    }
    if (["queued", "running"].includes(run.status)) {
      const cancel = document.createElement("button");
      cancel.className = "button quiet";
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", async () => {
        await fetch("/api/command/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: run.id }),
        });
        await loadCommandRuns();
      });
      item.append(cancel);
    }
    if (["cancelled", "partial", "failed"].includes(run.status) && Number(run.processed_count || 0) < Number(run.total_count || 0)) {
      const resume = document.createElement("button");
      resume.className = "button quiet";
      resume.type = "button";
      resume.textContent = "Resume queued work";
      resume.addEventListener("click", async () => {
        const response = await fetch("/api/command/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: run.id }),
        });
        const result = await response.json();
        if (!response.ok) commandStatus.textContent = result.error || "Could not resume run";
        await loadCommandRuns();
      });
      item.append(resume);
    }
    commandRuns.append(item);
  }
}

async function loadCommandRuns() {
  try {
    const response = await fetch("/api/command/status", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load classification runs");
    renderCommandRuns(result.runs || []);
  } catch (error) {
    commandRuns.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function startCommandRun(event) {
  event.preventDefault();
  commandStatus.textContent = "Creating durable run…";
  commandStatus.classList.remove("error");
  try {
    const response = await fetch("/api/command/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commandPayload()),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not start run");
    commandStatus.textContent = `Run ${result.id} queued with ${result.queued_email_count} emails. It continues independently of this browser tab.`;
    await loadCommandRuns();
  } catch (error) {
    commandStatus.textContent = error instanceof Error ? error.message : String(error);
    commandStatus.classList.add("error");
  }
}

function currentIndex() {
  const index = dataset.emails.findIndex((email) => email.email_id === state.currentEmailId);
  return index < 0 ? 0 : index;
}

function currentEmail() {
  return dataset.emails[currentIndex()];
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  const saveStatus = document.querySelector("#saveStatus");
  saveStatus.textContent = `Saved in browser at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

async function persistLabel(emailId) {
  const result = state.labels[emailId];
  if (!result?.category) return;
  const saveStatus = document.querySelector("#saveStatus");
  saveStatus.textContent = "Saving to labeled JSON…";
  try {
    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email_id: emailId,
        manual_label: result.category,
        review_notes: result.notes || "",
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Save failed with status ${response.status}`);
    saveStatus.textContent = `${payload.labeled_count} labels saved to private JSON`;
  } catch (error) {
    saveStatus.textContent = "Saved in browser; JSON sync failed";
    console.error(error);
  }
}

function matchesFilters(email) {
  const result = state.labels[email.email_id];
  if (activeFilter === "unreviewed" && result?.category) return false;
  if (activeFilter === "atc" && email.selection_reason !== "atc_required") return false;
  if (!searchTerm) return true;
  const haystack = [email.subject, email.from_name, email.from_email, email.snippet, email.body_text]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm);
}

function renderList() {
  emailList.replaceChildren();
  for (const email of dataset.emails.filter(matchesFilters)) {
    const result = state.labels[email.email_id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `email-list-item${email.email_id === state.currentEmailId ? " active" : ""}${result?.category ? " reviewed" : ""}`;
    button.addEventListener("click", () => selectEmail(email.email_id));

    const dot = document.createElement("span");
    dot.className = "status-dot";
    const copy = document.createElement("span");
    copy.className = "email-list-copy";
    const subject = document.createElement("strong");
    subject.textContent = email.subject || "(no subject)";
    const meta = document.createElement("span");
    meta.textContent = result?.category
      ? displayCategory(result.category)
      : email.selection_reason === "atc_required"
        ? "ATC · Unreviewed"
        : "Unreviewed";
    copy.append(subject, meta);
    button.append(dot, copy);
    emailList.append(button);
  }
}

function renderCategories() {
  const email = currentEmail();
  const selected = state.labels[email.email_id]?.category;
  categoryButtons.replaceChildren();
  dataset.categories.forEach((category, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-button${selected === category ? " selected" : ""}`;
    button.title = categoryDescriptions[category] || "";
    button.addEventListener("click", () => labelCurrent(category));

    const key = document.createElement("span");
    key.className = "shortcut";
    key.textContent = String(index + 1);
    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = displayCategory(category);
    button.append(key, name);
    categoryButtons.append(button);
  });
}

function renderCounts() {
  const counts = Object.fromEntries(dataset.categories.map((category) => [category, 0]));
  Object.values(state.labels).forEach((result) => {
    if (result.category && result.category in counts) counts[result.category] += 1;
  });
  categoryCounts.replaceChildren();
  for (const category of dataset.categories) {
    const row = document.createElement("div");
    row.className = "count-row";
    const label = document.createElement("span");
    label.textContent = displayCategory(category);
    const count = document.createElement("strong");
    count.textContent = String(counts[category]);
    row.append(label, count);
    categoryCounts.append(row);
  }
}

function renderProgress() {
  const completed = dataset.emails.filter((email) => state.labels[email.email_id]?.category).length;
  document.querySelector("#progressText").textContent = `${completed} / ${dataset.emails.length} reviewed`;
  document.querySelector("#progressBar").style.width = `${(completed / dataset.emails.length) * 100}%`;
}

function renderEmail() {
  const email = currentEmail();
  const result = state.labels[email.email_id] || {};
  document.querySelector("#positionText").textContent = `Email ${currentIndex() + 1} of ${dataset.emails.length}`;
  document.querySelector("#subject").textContent = email.subject || "(no subject)";
  document.querySelector("#sender").textContent = [email.from_name, email.from_email].filter(Boolean).join(" · ") || "Unknown";
  document.querySelector("#date").textContent = new Date(email.internal_date).toLocaleString();
  document.querySelector("#snippet").textContent = email.snippet || "No snippet available.";
  document.querySelector("#emailBody").textContent = email.body_text || "No plain-text body available.";
  document.querySelector("#gmailLink").href = `https://mail.google.com/mail/u/0/#all/${email.gmail_message_id}`;
  reviewNotes.value = result.notes || "";

  const badges = document.querySelector("#badges");
  badges.replaceChildren();
  const direction = document.createElement("span");
  direction.className = "badge";
  direction.textContent = email.direction;
  badges.append(direction);
  if (email.selection_reason === "atc_required") {
    const priority = document.createElement("span");
    priority.className = "badge atc";
    priority.textContent = "ATC included";
    badges.append(priority);
  }
  if (result.category) {
    const label = document.createElement("span");
    label.className = "badge label";
    label.textContent = displayCategory(result.category);
    badges.append(label);
  }

  renderCategories();
  renderList();
  renderCounts();
  renderProgress();
  document.querySelector(".reader").scrollTop = 0;
}

function selectEmail(emailId) {
  state.currentEmailId = emailId;
  saveState();
  renderEmail();
}

function moveBy(offset) {
  const index = Math.min(dataset.emails.length - 1, Math.max(0, currentIndex() + offset));
  selectEmail(dataset.emails[index].email_id);
}

function goToNextUnreviewed() {
  const start = currentIndex();
  for (let step = 1; step <= dataset.emails.length; step += 1) {
    const index = (start + step) % dataset.emails.length;
    const email = dataset.emails[index];
    if (!state.labels[email.email_id]?.category) {
      selectEmail(email.email_id);
      return;
    }
  }
}

function labelCurrent(category) {
  const email = currentEmail();
  state.labels[email.email_id] = {
    ...state.labels[email.email_id],
    category,
    notes: reviewNotes.value.trim(),
    updated_at: new Date().toISOString(),
  };
  saveState();
  void persistLabel(email.email_id);
  renderEmail();
  window.setTimeout(goToNextUnreviewed, 120);
}

async function addUniqueEmails() {
  const count = Number.parseInt(document.querySelector("#resampleCount").value, 10);
  const strategy = document.querySelector("#resampleStrategy").value;
  confirmResample.disabled = true;
  resampleStatus.classList.remove("error");
  resampleStatus.textContent = "Reading Supabase and excluding previously sampled emails…";
  try {
    const response = await fetch("/api/resample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, strategy }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Resample failed with status ${response.status}`);
    dataset.emails.push(...payload.emails);
    state.currentEmailId = payload.emails[0].email_id;
    saveState();
    resampleDialog.close();
    document.querySelector("#saveStatus").textContent = `Added ${payload.emails.length} unique emails · ${payload.unseen_remaining} remain`;
    renderEmail();
  } catch (error) {
    resampleStatus.classList.add("error");
    resampleStatus.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    confirmResample.disabled = false;
  }
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportFile(type) {
  const rows = dataset.emails.map((email) => ({
    ...email,
    manual_label: state.labels[email.email_id]?.category || null,
    review_notes: state.labels[email.email_id]?.notes || "",
    labeled_at: state.labels[email.email_id]?.updated_at || null,
  }));
  let contents;
  let mimeType;
  if (type === "json") {
    contents = `${JSON.stringify({ ...dataset, exported_at: new Date().toISOString(), emails: rows }, null, 2)}\n`;
    mimeType = "application/json";
  } else {
    const headers = ["sample_index", "email_id", "subject", "direction", "selection_reason", "manual_label", "review_notes"];
    contents = `${[headers, ...rows.map((row) => headers.map((header) => row[header]))]
      .map((row) => row.map(csvCell).join(","))
      .join("\n")}\n`;
    mimeType = "text/csv";
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  link.download = `email-labels-150.${type}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function initialize() {
  try {
    const [sampleResponse, labelsResponse] = await Promise.all([
      fetch("/sample.json", { cache: "no-store" }),
      fetch("/api/labels", { cache: "no-store" }),
    ]);
    if (!sampleResponse.ok) throw new Error(`Sample request failed with status ${sampleResponse.status}`);
    if (!labelsResponse.ok) throw new Error(`Labels request failed with status ${labelsResponse.status}`);
    dataset = await sampleResponse.json();
    const labeledStore = await labelsResponse.json();
    storageKey = "email-labeling:review-pool-v1";
    const saved = localStorage.getItem(storageKey);
    if (saved) state = JSON.parse(saved);
    for (const email of labeledStore.emails) {
      state.labels[email.email_id] = {
        category: email.manual_label,
        notes: email.review_notes || "",
        updated_at: email.labeled_at,
      };
    }
    if (!state.currentEmailId || !dataset.emails.some((email) => email.email_id === state.currentEmailId)) {
      state.currentEmailId = dataset.emails[0].email_id;
    }

    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      renderList();
    });
    document.querySelectorAll(".filter").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
        renderList();
      });
    });
    reviewNotes.addEventListener("input", () => {
      const email = currentEmail();
      state.labels[email.email_id] = {
        ...state.labels[email.email_id],
        notes: reviewNotes.value,
        updated_at: new Date().toISOString(),
      };
      saveState();
      window.clearTimeout(noteSaveTimer);
      if (state.labels[email.email_id].category) {
        noteSaveTimer = window.setTimeout(() => void persistLabel(email.email_id), 600);
      }
    });
    document.querySelector("#previousEmail").addEventListener("click", () => moveBy(-1));
    document.querySelector("#nextEmail").addEventListener("click", () => moveBy(1));
    document.querySelector("#nextUnreviewed").addEventListener("click", goToNextUnreviewed);
    document.querySelector("#exportJson").addEventListener("click", () => exportFile("json"));
    document.querySelector("#exportCsv").addEventListener("click", () => exportFile("csv"));
    for (const tab of viewTabs) {
      tab.addEventListener("click", () => navigateToView(tab.dataset.view));
    }
    window.addEventListener("hashchange", () => switchView(window.location.hash.slice(1) || "review"));
    document.querySelector("#refreshBenchmark").addEventListener("click", () => void loadBenchmark());
    benchmarkFilter.addEventListener("change", renderBenchmarkRows);
    benchmarkScope.addEventListener("change", () => void loadBenchmark());
    document.querySelector("#refreshCommand").addEventListener("click", () => void loadCommandRuns());
    document.querySelector("#previewCommand").addEventListener("click", () => void previewCommand());
    commandScope.addEventListener("change", () => void previewCommand());
    commandForm.addEventListener("submit", (event) => void startCommandRun(event));
    document.querySelector("#openResample").addEventListener("click", () => {
      resampleStatus.textContent = "";
      resampleStatus.classList.remove("error");
      resampleDialog.showModal();
    });
    confirmResample.addEventListener("click", () => void addUniqueEmails());
    document.addEventListener("keydown", (event) => {
      if (reviewReader.hidden) return;
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      const shortcut = Number.parseInt(event.key, 10);
      if (shortcut >= 1 && shortcut <= dataset.categories.length) {
        labelCurrent(dataset.categories[shortcut - 1]);
      } else if (event.key === "ArrowLeft") {
        moveBy(-1);
      } else if (event.key === "ArrowRight") {
        moveBy(1);
      }
    });

    app.setAttribute("aria-busy", "false");
    saveState();
    if (labeledStore.emails.length > 0) {
      document.querySelector("#saveStatus").textContent = `${labeledStore.emails.length} labels loaded from private JSON`;
    }
    renderEmail();
    switchView(window.location.hash.slice(1) || "review");
  } catch (error) {
    app.hidden = true;
    errorState.hidden = false;
    errorMessage.textContent = error instanceof Error ? error.message : String(error);
  }
}

initialize();
