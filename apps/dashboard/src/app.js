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
const viewTabs = [...document.querySelectorAll("[data-view]")];
const labSwitch = document.querySelector("#labSwitch");
const labTabs = [...document.querySelectorAll("[data-lab-mode]")];
const boardSwitch = document.querySelector("#boardSwitch");
const boardTabs = [...document.querySelectorAll("[data-board-mode]")];
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
const commandStatus = document.querySelector("#commandStatus");
const automationHealth = document.querySelector("#automationHealth");
const automationHealthTitle = document.querySelector("#automationHealthTitle");
const automationHealthDetail = document.querySelector("#automationHealthDetail");
const automationHealthMetric = document.querySelector("#automationHealthMetric");
const commandAccount = document.querySelector("#commandAccount");
const commandIngestionState = document.querySelector("#commandIngestionState");
const commandIngestionMessage = document.querySelector("#commandIngestionMessage");
const commandNewCount = document.querySelector("#commandNewCount");
const commandUpdatedCount = document.querySelector("#commandUpdatedCount");
const commandMailboxCount = document.querySelector("#commandMailboxCount");
const commandIngestionProgress = document.querySelector("#commandIngestionProgress");
const commandClassificationState = document.querySelector("#commandClassificationState");
const commandUnclassifiedCount = document.querySelector("#commandUnclassifiedCount");
const commandClassifiedCount = document.querySelector("#commandClassifiedCount");
const commandRunProgress = document.querySelector("#commandRunProgress");
const commandRunProgressLabel = document.querySelector("#commandRunProgressLabel");
const commandClassificationProgress = document.querySelector("#commandClassificationProgress");
const commandCorrectionCount = document.querySelector("#commandCorrectionCount");
const syncNewEmails = document.querySelector("#syncNewEmails");
const startCommandClassification = document.querySelector("#startCommandClassification");
const ingestionStep = document.querySelector("#ingestionStep");
const classificationStep = document.querySelector("#classificationStep");
const outputStep = document.querySelector("#outputStep");
const commandOutputState = document.querySelector("#commandOutputState");
const commandBoardCount = document.querySelector("#commandBoardCount");
const commandApplicationCount = document.querySelector("#commandApplicationCount");
const refreshCommandOutputs = document.querySelector("#refreshCommandOutputs");
const commandOutputProgress = document.querySelector("#commandOutputProgress");
const pipelineSteps = [...document.querySelectorAll("[data-pipeline-step]")];
const pipelineDetails = [...document.querySelectorAll("[data-step-detail]")];
const pipelineDetailKicker = document.querySelector("#pipelineDetailKicker");
const pipelineDetailTitle = document.querySelector("#pipelineDetailTitle");
const pipelineDetailSummary = document.querySelector("#pipelineDetailSummary");
const flowGmailCount = document.querySelector("#flowGmailCount");
const flowStoredCount = document.querySelector("#flowStoredCount");
const flowWaitingCount = document.querySelector("#flowWaitingCount");
const flowClassifiedCount = document.querySelector("#flowClassifiedCount");
const flowApplicationCount = document.querySelector("#flowApplicationCount");
const flowIngestionStage = document.querySelector("#flowIngestionStage");
const flowPages = document.querySelector("#flowPages");
const flowIteration = document.querySelector("#flowIteration");
const flowDiscovered = document.querySelector("#flowDiscovered");
const flowExisting = document.querySelector("#flowExisting");
const flowPending = document.querySelector("#flowPending");
const flowInserted = document.querySelector("#flowInserted");
const flowUpdated = document.querySelector("#flowUpdated");
const flowSkipped = document.querySelector("#flowSkipped");
const flowDeleted = document.querySelector("#flowDeleted");
const flowRunStatus = document.querySelector("#flowRunStatus");
const flowRunTotal = document.querySelector("#flowRunTotal");
const flowRunProcessed = document.querySelector("#flowRunProcessed");
const flowRunSucceeded = document.querySelector("#flowRunSucceeded");
const flowRunFailed = document.querySelector("#flowRunFailed");
const flowRunUncertain = document.querySelector("#flowRunUncertain");
const flowOutputStage = document.querySelector("#flowOutputStage");
const flowOutputPercent = document.querySelector("#flowOutputPercent");
const flowOutputEmails = document.querySelector("#flowOutputEmails");
const flowOutputApplications = document.querySelector("#flowOutputApplications");
const flowOutputCorrections = document.querySelector("#flowOutputCorrections");
const battlegroundView = document.querySelector("#battlegroundView");
const battlegroundForm = document.querySelector("#battlegroundForm");
const battlegroundStatus = document.querySelector("#battlegroundStatus");
const battlegroundCards = document.querySelector("#battlegroundCards");
const battlegroundRows = document.querySelector("#battlegroundRows");
const battlegroundProgress = document.querySelector("#battlegroundProgress");
const battlegroundRunLabel = document.querySelector("#battlegroundRunLabel");
const battlegroundResultCount = document.querySelector("#battlegroundResultCount");
const battlegroundDecisionMap = document.querySelector("#battlegroundDecisionMap");
const battlegroundDecisionCount = document.querySelector("#battlegroundDecisionCount");
const boardView = document.querySelector("#boardView");
const boardList = document.querySelector("#boardList");
const boardDetail = document.querySelector("#boardDetail");
const boardCount = document.querySelector("#boardCount");
const boardCategory = document.querySelector("#boardCategory");
const boardAction = document.querySelector("#boardAction");
const analyticsView = document.querySelector("#analyticsView");
const analyticsStatus = document.querySelector("#analyticsStatus");
const analyticsContent = document.querySelector("#analyticsContent");
const analyticsCards = document.querySelector("#analyticsCards");
const analyticsNarrative = document.querySelector("#analyticsNarrative");
const analyticsActivity = document.querySelector("#analyticsActivity");
const analyticsCategories = document.querySelector("#analyticsCategories");
const analyticsActions = document.querySelector("#analyticsActions");
const analyticsConfidence = document.querySelector("#analyticsConfidence");
const analyticsBenchmark = document.querySelector("#analyticsBenchmark");
const analyticsRuns = document.querySelector("#analyticsRuns");
const lifecycleSankey = document.querySelector("#lifecycleSankey");
const applicationsView = document.querySelector("#applicationsView");
const applicationStatus = document.querySelector("#applicationStatus");
const applicationBoard = document.querySelector("#applicationBoard");
const applicationCount = document.querySelector("#applicationCount");
const applicationDetail = document.querySelector("#applicationDetail");
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
let battlegroundPollTimer;
let boardEmails = [];
let boardCurrentEmailId = null;
let boardReplyProfile = "";
let boardReplyReady = false;
let applications = [];
let currentApplicationId = null;
let currentLabMode = "quality";
let currentBoardMode = "emails";
let selectedPipelineStep = "ingestion";
let latestCommandSnapshot = null;

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
  return category ? category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unclassified";
}

function displayPercent(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
}

function switchView(view, mode = null) {
  const labActive = view === "lab";
  const applicationBoardActive = view === "application_board";
  if (labActive && ["labels", "quality", "performance"].includes(mode)) currentLabMode = mode;
  if (applicationBoardActive && ["emails", "applications"].includes(mode)) currentBoardMode = mode;
  const benchmarkActive = labActive && currentLabMode === "quality";
  const reviewActive = labActive && currentLabMode === "labels";
  const commandActive = view === "command";
  const battlegroundActive = labActive && currentLabMode === "performance";
  const boardActive = applicationBoardActive && currentBoardMode === "emails";
  const analyticsActive = view === "analytics";
  const applicationsActive = applicationBoardActive && currentBoardMode === "applications";
  app.classList.toggle("benchmark-mode", !reviewActive);
  app.classList.toggle("lab-mode", labActive);
  app.classList.toggle("board-mode", applicationBoardActive);
  reviewSidebar.hidden = !reviewActive;
  reviewReader.hidden = !reviewActive;
  reviewClassifier.hidden = !reviewActive;
  benchmarkView.hidden = !benchmarkActive;
  commandView.hidden = !commandActive;
  battlegroundView.hidden = !battlegroundActive;
  boardView.hidden = !boardActive;
  analyticsView.hidden = !analyticsActive;
  applicationsView.hidden = !applicationsActive;
  labSwitch.hidden = !labActive;
  boardSwitch.hidden = !applicationBoardActive;
  topActions.hidden = !reviewActive;
  progressBlock.hidden = !reviewActive;
  for (const tab of viewTabs) {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  for (const tab of labTabs) {
    const active = tab.dataset.labMode === currentLabMode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  for (const tab of boardTabs) {
    const active = tab.dataset.boardMode === currentBoardMode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  if (benchmarkActive) void loadBenchmark();
  window.clearInterval(commandPollTimer);
  window.clearInterval(battlegroundPollTimer);
  if (commandActive) {
    void loadCommandRuns();
    commandPollTimer = window.setInterval(() => void loadCommandRuns(), 2000);
  }
  if (battlegroundActive) {
    void loadBattleground();
    battlegroundPollTimer = window.setInterval(() => void loadBattleground(), 1000);
  }
  if (boardActive) void loadBoard();
  if (analyticsActive) void loadAnalytics();
  if (applicationsActive) void loadApplications();
}

function navigateToView(view) {
  const safeView = ["command", "application_board", "lab", "analytics"].includes(view) ? view : "command";
  if (safeView === "lab") {
    navigateToLab(currentLabMode);
    return;
  }
  if (safeView === "application_board") {
    navigateToBoard(currentBoardMode);
    return;
  }
  if (window.location.hash !== `#${safeView}`) window.location.hash = safeView;
  else switchView(safeView);
}

function navigateToBoard(mode) {
  const safeMode = ["emails", "applications"].includes(mode) ? mode : "emails";
  const hash = `#application-board-${safeMode}`;
  if (window.location.hash !== hash) window.location.hash = hash;
  else switchView("application_board", safeMode);
}

function navigateToLab(mode) {
  const safeMode = ["labels", "quality", "performance"].includes(mode) ? mode : "quality";
  const hash = `#lab-${safeMode}`;
  if (window.location.hash !== hash) window.location.hash = hash;
  else switchView("lab", safeMode);
}

function routeFromHash() {
  const hash = window.location.hash.slice(1);
  const labRoutes = {
    "lab-labels": "labels",
    "lab-quality": "quality",
    "lab-performance": "performance",
    review: "labels",
    benchmark: "quality",
    battleground: "performance",
  };
  if (hash in labRoutes) return { view: "lab", labMode: labRoutes[hash] };
  const boardRoutes = {
    "application-board": "emails",
    "application-board-emails": "emails",
    "application-board-applications": "applications",
    board: "emails",
    applications: "applications",
  };
  if (hash in boardRoutes) return { view: "application_board", boardMode: boardRoutes[hash] };
  return { view: ["command", "analytics"].includes(hash) ? hash : "command" };
}

function applyRouteFromHash() {
  const route = routeFromHash();
  switchView(route.view, route.labMode || route.boardMode);
}

function formatMilliseconds(value) {
  if (!Number.isFinite(value)) return "—";
  if (value < 1_000) return `${value.toFixed(0)} ms`;
  return `${(value / 1_000).toFixed(2)} s`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function battlegroundMetric(label, value, detail) {
  const card = document.createElement("article");
  card.className = "metric-card";
  const name = document.createElement("span");
  name.textContent = label;
  const result = document.createElement("strong");
  result.textContent = value;
  const copy = document.createElement("small");
  copy.textContent = detail;
  card.append(name, result, copy);
  battlegroundCards.append(card);
}

function renderBattlegroundDecisionMap(summary = []) {
  battlegroundDecisionMap.replaceChildren();
  const visibleSummary = summary
    .filter((item) => Number(item.count || 0) > 0)
    .sort((left, right) => Number(right.count || 0) - Number(left.count || 0));
  const total = visibleSummary.reduce((sum, item) => sum + Number(item.count || 0), 0);
  battlegroundDecisionCount.textContent = `${total.toLocaleString()} outcomes`;
  if (!visibleSummary.length) {
    const empty = document.createElement("p");
    empty.className = "decision-map-empty";
    empty.textContent = "Decisions will appear here as Jev completes each wave.";
    battlegroundDecisionMap.append(empty);
    return;
  }

  const mapWidth = Math.max(320, battlegroundDecisionMap.clientWidth || 480);
  const mapHeight = Math.max(160, battlegroundDecisionMap.clientHeight || 180);
  const root = window.d3?.hierarchy && window.d3?.treemap
    ? window.d3.hierarchy({ children: visibleSummary })
      .sum((item) => Number(item.count || 0))
      .sort((left, right) => right.value - left.value)
    : null;
  if (root) {
    window.d3.treemap()
      .tile(window.d3.treemapSquarify.ratio(1.25))
      .size([mapWidth, mapHeight])
      .paddingInner(0)
      .round(true)(root);
  }
  const leaves = root?.leaves() || visibleSummary.map((item, index) => ({
    data: item,
    x0: (index / visibleSummary.length) * mapWidth,
    x1: ((index + 1) / visibleSummary.length) * mapWidth,
    y0: 0,
    y1: mapHeight,
  }));

  for (const leaf of leaves) {
    const item = leaf.data;
    const count = Number(item.count || 0);
    const confidence = typeof item.average_confidence === "number" ? item.average_confidence : null;
    const tile = document.createElement("article");
    const confidenceBand = confidence === null ? "" : confidence < 0.6 ? " low" : confidence < 0.8 ? " medium" : " high";
    tile.className = `decision-map-tile${item.category === "failed" ? " failed" : confidenceBand}`;
    const tileWidth = Math.max(0, leaf.x1 - leaf.x0);
    const tileHeight = Math.max(0, leaf.y1 - leaf.y0);
    tile.classList.toggle("compact", tileWidth < 150 || tileHeight < 92);
    tile.classList.toggle("micro", tileWidth < 90 || tileHeight < 58);
    tile.style.left = `${(leaf.x0 / mapWidth) * 100}%`;
    tile.style.top = `${(leaf.y0 / mapHeight) * 100}%`;
    tile.style.width = `${(tileWidth / mapWidth) * 100}%`;
    tile.style.height = `${(tileHeight / mapHeight) * 100}%`;
    tile.title = item.category === "failed"
      ? `${count.toLocaleString()} requests failed or were rate-limited`
      : `${count.toLocaleString()} ${displayCategory(item.category)} decisions · ${displayPercent(confidence)} average confidence`;

    const label = document.createElement("span");
    label.textContent = item.category === "failed" ? "Failed / rate-limited" : displayCategory(item.category);
    const value = document.createElement("strong");
    value.textContent = count.toLocaleString();
    const share = document.createElement("small");
    share.textContent = `${displayPercent(total ? count / total : 0)} of outcomes`;
    const confidenceLine = document.createElement("small");
    confidenceLine.className = "decision-map-confidence";
    confidenceLine.textContent = confidence === null
      ? "No confidence returned"
      : `${displayPercent(confidence)} avg · H ${item.high_confidence_count} · M ${item.medium_confidence_count} · L ${item.low_confidence_count}`;
    tile.append(label, value, share, confidenceLine);
    battlegroundDecisionMap.append(tile);
  }
}

function renderBattleground(report) {
  battlegroundCards.replaceChildren();
  battlegroundRows.replaceChildren();
  if (!report) {
    battlegroundRunLabel.textContent = "No run";
    battlegroundStatus.textContent = "Choose a random pool and run the first test.";
    battlegroundProgress.style.width = "0%";
    battlegroundResultCount.textContent = "0 emails";
    renderBattlegroundDecisionMap();
    return;
  }

  const selected = Number(report.selected_count || report.config.sampleSize || 0);
  const completed = Number(report.completed_count || 0);
  battlegroundProgress.style.width = `${selected ? (completed / selected) * 100 : 0}%`;
  battlegroundRunLabel.textContent = `${report.status} · concurrency ${report.config.concurrency}`;
  const visibleResults = Array.isArray(report.results) ? report.results.length : 0;
  battlegroundResultCount.textContent = visibleResults < completed
    ? `${completed} of ${selected} completed · showing latest ${visibleResults}`
    : `${completed} of ${selected} emails`;
  battlegroundStatus.classList.toggle("error", report.status === "failed");
  battlegroundStatus.textContent = report.error || (
    report.status === "running" || report.status === "queued"
      ? `Classifying ${completed}/${selected || report.config.sampleSize} — no artificial request delay is active.`
      : `Completed ${report.succeeded_count} successfully with ${report.failed_count} failures.`
  );
  renderBattlegroundDecisionMap(report.decision_summary || []);

  const metrics = report.metrics;
  if (metrics) {
    const successRate = Number.isFinite(metrics.success_rate)
      ? metrics.success_rate
      : completed ? Number(report.succeeded_count || 0) / completed : 0;
    const successfulRate = Number.isFinite(metrics.successful_throughput_per_second)
      ? metrics.successful_throughput_per_second
      : metrics.throughput_per_second;
    battlegroundMetric("Wall clock", formatMilliseconds(metrics.wall_ms), `Selection ${formatMilliseconds(metrics.selection_ms)} · bulk load ${formatMilliseconds(metrics.email_load_ms)}`);
    battlegroundMetric("Observed rate", `${metrics.throughput_per_second.toFixed(2)}/sec`, `${successfulRate.toFixed(2)}/sec successful · wave ${formatMilliseconds(metrics.classification_ms)}`);
    battlegroundMetric("Success rate", displayPercent(successRate), `${metrics.rate_limited_count || 0} HTTP 429 rate limits`);
    battlegroundMetric("Completed", completed.toLocaleString(), `of ${selected.toLocaleString()} selected · ${Number(report.failed_count || 0).toLocaleString()} failed`);
    battlegroundMetric("Average Jev", formatMilliseconds(metrics.average_jev_ms), `p50 ${formatMilliseconds(metrics.p50_jev_ms)} · p95 ${formatMilliseconds(metrics.p95_jev_ms)}`);
    battlegroundMetric("App overhead", formatMilliseconds(metrics.average_application_overhead_ms), "Bulk DB load amortized + local processing");
    battlegroundMetric("Full mailbox estimate", formatDuration(metrics.projected_mailbox_seconds), `${report.active_mailbox_count.toLocaleString()} active emails at this observed rate`);
    battlegroundMetric("Input tokens", metrics.total_input_tokens.toLocaleString(), "Across completed Jev calls");
  }

  for (const row of report.results || []) {
    const tr = document.createElement("tr");
    const email = document.createElement("td");
    const subject = document.createElement(row.gmail_message_id ? "a" : "strong");
    subject.textContent = row.subject || "(no subject)";
    if (row.gmail_message_id) {
      subject.href = `https://mail.google.com/mail/u/0/#all/${row.gmail_message_id}`;
      subject.target = "_blank";
      subject.rel = "noreferrer";
      subject.title = row.snippet || row.subject || "Open original in Gmail";
    }
    const sender = document.createElement("small");
    sender.textContent = row.sender;
    email.append(subject, sender);
    const decision = document.createElement("td");
    decision.textContent = row.status === "failed"
      ? `Failed${row.http_status ? ` ${row.http_status}` : ""}: ${row.error_type || row.error || "Unknown error"}`
      : `${displayCategory(row.decision || row.category)} · ${displayPercent(row.top_probability)}`;
    if (row.status === "failed" && row.error) decision.title = row.error;
    const jev = document.createElement("td");
    jev.textContent = formatMilliseconds(row.jev_ms);
    const overhead = document.createElement("td");
    overhead.textContent = formatMilliseconds(row.application_overhead_ms);
    const worker = document.createElement("td");
    worker.textContent = formatMilliseconds(row.worker_ms);
    tr.append(email, decision, jev, overhead, worker);
    battlegroundRows.append(tr);
  }
}

async function loadBattleground() {
  try {
    const response = await fetch("/api/battleground", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load Battleground");
    renderBattleground(payload.report);
    if (payload.report && !["queued", "running"].includes(payload.report.status)) {
      window.clearInterval(battlegroundPollTimer);
    }
  } catch (error) {
    battlegroundStatus.classList.add("error");
    battlegroundStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function startBattleground(event) {
  event.preventDefault();
  const button = document.querySelector("#startBattleground");
  button.disabled = true;
  battlegroundStatus.classList.remove("error");
  battlegroundStatus.textContent = "Selecting a fresh random pool…";
  try {
    const response = await fetch("/api/battleground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sample_size: Number(document.querySelector("#battlegroundSample").value),
        concurrency: Number(document.querySelector("#battlegroundConcurrency").value),
        minimum_top_probability: Number(document.querySelector("#battlegroundThreshold").value),
        max_retries: Number(document.querySelector("#battlegroundRetries").value),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not start Battleground");
    renderBattleground(payload.report);
    window.clearInterval(battlegroundPollTimer);
    battlegroundPollTimer = window.setInterval(() => void loadBattleground(), 1000);
  } catch (error) {
    battlegroundStatus.classList.add("error");
    battlegroundStatus.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderBoardList() {
  boardList.replaceChildren();
  boardCount.textContent = `${boardEmails.length} emails`;
  if (!boardEmails.length) {
    boardList.append(element("p", "board-empty", "No emails match this category."));
    return;
  }
  const visibleCategories = boardCategory.value === "all"
    ? Object.keys(categoryDescriptions)
    : [boardCategory.value];
  for (const category of visibleCategories) {
    const emails = boardEmails.filter((email) => email.effective_category === category);
    const lane = element("section", `board-lane category-${category}`);
    const laneHeading = element("header", "board-lane-heading");
    laneHeading.append(
      element("strong", "", displayCategory(category)),
      element("span", "", String(emails.length)),
    );
    const cards = element("div", "board-lane-cards");
    if (!emails.length) cards.append(element("p", "board-lane-empty", "No emails"));
    for (const email of emails) {
      const button = element("button", `board-item${email.email_id === boardCurrentEmailId ? " active" : ""}`);
      button.type = "button";
      button.append(
        element("strong", "", email.subject || "(no subject)"),
        element("small", "", [email.from_name, email.from_email].filter(Boolean).join(" · ") || "Unknown sender"),
        element("small", "board-card-meta", `${email.human_category ? "Human corrected" : "Jev"} · ${displayPercent(email.category_top_probability)}`),
      );
      button.addEventListener("click", () => void loadBoardEmail(email.email_id));
      cards.append(button);
    }
    lane.append(laneHeading, cards);
    boardList.append(lane);
  }
}

function categorySelect(selected) {
  const select = document.createElement("select");
  for (const category of Object.keys(categoryDescriptions)) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = displayCategory(category);
    option.selected = category === selected;
    select.append(option);
  }
  return select;
}

function renderBoardDetail(email) {
  boardDetail.replaceChildren();
  const header = element("div", "board-email-header");
  const badges = element("div", "badges");
  badges.append(
    element("span", "badge", `Jev: ${displayCategory(email.jev_decision)} · ${displayPercent(email.category_top_probability)}`),
    element("span", `badge${email.human_category ? " human" : ""}`, email.human_category ? `Human: ${displayCategory(email.human_category)}` : "No human correction"),
    element("span", "badge", `Action: ${displayCategory(email.next_action)}`),
  );
  const subject = element("h3", "", email.subject || "(no subject)");
  const meta = element("p", "board-email-meta", `${[email.from_name, email.from_email].filter(Boolean).join(" · ") || "Unknown sender"} · ${new Date(email.internal_date).toLocaleString()}`);
  const gmail = element("a", "gmail-link", "Open original in Gmail ↗");
  gmail.href = `https://mail.google.com/mail/u/0/#all/${email.gmail_message_id}`;
  gmail.target = "_blank";
  gmail.rel = "noreferrer";
  header.append(badges, subject, meta, gmail);

  const body = element("pre", "board-email-body", email.body_text || email.snippet || "No readable body.");

  const correction = element("section", "board-tool");
  correction.append(element("h4", "", "Correct Jev decision"), element("p", "board-help", "The Jev result remains unchanged. This saves the current human decision and adds it to the Jev Lab Label Set."));
  const correctionSelect = categorySelect(email.human_category || email.jev_decision || "uncertain");
  const correctionNotes = document.createElement("textarea");
  correctionNotes.rows = 3;
  correctionNotes.placeholder = "Why are you changing this? Optional.";
  correctionNotes.value = email.human_label_notes || "";
  const correctionStatus = element("p", "resample-status", "");
  const correctionButton = element("button", "button primary", "Save correction");
  correctionButton.type = "button";
  correctionButton.addEventListener("click", async () => {
    correctionButton.disabled = true;
    correctionStatus.textContent = "Saving…";
    try {
      const response = await fetch("/api/board/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_id: email.id, category: correctionSelect.value, notes: correctionNotes.value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save correction");
      correctionStatus.textContent = "Human correction saved.";
      await loadBoard(false);
      await loadBoardEmail(email.id);
    } catch (error) {
      correctionStatus.classList.add("error");
      correctionStatus.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      correctionButton.disabled = false;
    }
  });
  correction.append(correctionSelect, correctionNotes, correctionButton, correctionStatus);

  boardDetail.append(header, body, correction);
  if (email.effective_category === "reply_needed") {
    const drafting = element("section", "board-tool reply-drafting");
    drafting.append(element("h4", "", "Generate reply draft with GPT-4o Mini"), element("p", "board-help", "The full email, Jev context, correction, and your instructions are sent to GPT-4o Mini. The draft is saved for review and never sent automatically."));
    const profile = document.createElement("textarea");
    profile.rows = 4;
    profile.value = email.reply_draft_instructions || boardReplyProfile;
    profile.placeholder = "Your tone, relevant facts, availability, and what the reply should accomplish.";
    const draftButton = element("button", "button primary", "Generate draft");
    draftButton.type = "button";
    draftButton.disabled = !boardReplyReady;
    const draftStatus = element("p", "resample-status", boardReplyReady ? "" : "Configure OPENAI_API_KEY in .env, then restart the dashboard.");
    const draftSubject = document.createElement("input");
    draftSubject.placeholder = "Draft subject";
    draftSubject.value = email.reply_draft_subject || "";
    const draftBody = document.createElement("textarea");
    draftBody.rows = 12;
    draftBody.placeholder = "Generated reply appears here for editing and review.";
    draftBody.value = email.reply_draft_body || "";
    const reviewButton = element("button", "button secondary", email.reply_draft_status === "reviewed" ? "Reviewed draft saved" : "Save reviewed draft");
    reviewButton.type = "button";
    reviewButton.disabled = !draftSubject.value.trim() || !draftBody.value.trim();
    const syncReviewButton = () => {
      reviewButton.disabled = !draftSubject.value.trim() || !draftBody.value.trim();
      if (reviewButton.textContent === "Reviewed draft saved") reviewButton.textContent = "Save reviewed draft";
    };
    draftSubject.addEventListener("input", syncReviewButton);
    draftBody.addEventListener("input", syncReviewButton);
    draftButton.addEventListener("click", async () => {
      draftButton.disabled = true;
      draftStatus.classList.remove("error");
      draftStatus.textContent = "Generating a factual draft…";
      try {
        const response = await fetch("/api/board/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email_id: email.id, instructions: profile.value }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not generate reply draft");
        draftSubject.value = payload.draft.subject;
        draftBody.value = payload.draft.body;
        reviewButton.disabled = false;
        reviewButton.textContent = "Save reviewed draft";
        draftStatus.textContent = `Drafted with ${payload.draft.model}. Review it before using it.`;
      } catch (error) {
        draftStatus.classList.add("error");
        draftStatus.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        draftButton.disabled = !boardReplyReady;
      }
    });
    reviewButton.addEventListener("click", async () => {
      reviewButton.disabled = true;
      draftStatus.classList.remove("error");
      draftStatus.textContent = "Saving your reviewed version…";
      try {
        const response = await fetch("/api/board/draft/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email_id: email.id, subject: draftSubject.value, body: draftBody.value }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not save reviewed draft");
        reviewButton.textContent = "Reviewed draft saved";
        draftStatus.textContent = "Reviewed draft saved. Nothing was sent.";
      } catch (error) {
        draftStatus.classList.add("error");
        draftStatus.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        reviewButton.disabled = !draftSubject.value.trim() || !draftBody.value.trim();
      }
    });
    drafting.append(profile, draftButton, draftStatus, draftSubject, draftBody, reviewButton);
    boardDetail.append(drafting);
  }
}

async function loadBoardEmail(emailId) {
  boardCurrentEmailId = emailId;
  renderBoardList();
  boardDetail.replaceChildren(element("p", "board-empty", "Loading email context…"));
  try {
    const response = await fetch(`/api/board/email?id=${encodeURIComponent(emailId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load email");
    renderBoardDetail(payload.email);
  } catch (error) {
    boardDetail.replaceChildren(element("p", "board-empty error", error instanceof Error ? error.message : String(error)));
  }
}

async function loadBoard(selectFirst = false) {
  try {
    const rows = [];
    let offset = 0;
    let payload;
    do {
      const response = await fetch(`/api/board?limit=1000&offset=${offset}&category=${encodeURIComponent(boardCategory.value)}&action=${encodeURIComponent(boardAction.value)}`, { cache: "no-store" });
      payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load Email Board");
      rows.push(...(payload.emails || []));
      offset += payload.emails?.length || 0;
    } while (payload.has_more && payload.emails?.length);
    boardEmails = rows;
    boardReplyProfile = payload?.reply_profile || "";
    boardReplyReady = Boolean(payload?.reply_provider_ready);
    if (!boardEmails.some((email) => email.email_id === boardCurrentEmailId)) {
      boardCurrentEmailId = null;
      boardDetail.replaceChildren(element("p", "board-empty", "Choose a card to inspect the email and correct its decision."));
    }
    renderBoardList();
    if (selectFirst && !boardCurrentEmailId && boardEmails[0]) await loadBoardEmail(boardEmails[0].email_id);
  } catch (error) {
    boardList.replaceChildren(element("p", "board-empty error", error instanceof Error ? error.message : String(error)));
  }
}

const analyticsPalette = {
  applied: "#315efb",
  outreach: "#7c3aed",
  reply_needed: "#ea580c",
  interview_assessment: "#0891b2",
  offer: "#16a34a",
  rejected: "#dc2626",
  other: "#94a3b8",
  uncertain: "#d97706",
  high: "#16a34a",
  medium: "#60a5fa",
  low: "#d97706",
  not_available: "#cbd5e1",
};

function analyticsMetric(label, value, detail, accent = "", progress = null) {
  const card = element("article", `metric-card analytics-metric ${accent}`.trim());
  const copy = element("div", "analytics-metric-copy");
  copy.append(element("span", "", label), element("strong", "", value), element("small", "", detail));
  card.append(copy);
  if (typeof progress === "number") {
    const ring = element("span", "analytics-metric-ring");
    const bounded = Math.max(0, Math.min(1, progress));
    ring.style.setProperty("--metric-progress", `${bounded * 360}deg`);
    ring.append(element("i", "", `${Math.round(bounded * 100)}%`));
    card.append(ring);
  } else {
    const glyph = element("span", "analytics-metric-glyph", accent === "warning" ? "↗" : accent === "human" ? "✓" : accent === "uncertain" ? "?" : "▦");
    card.append(glyph);
  }
  analyticsCards.append(card);
}

function openBoardFromAnalytics(category = "all", action = "all") {
  boardCategory.value = category;
  boardAction.value = action;
  boardCurrentEmailId = null;
  navigateToBoard("emails");
}

function renderAnalyticsBars(container, items, options = {}) {
  container.replaceChildren();
  const actionable = options.actionable !== false;
  const insight = element("p", "analytics-chart-insight", options.defaultInsight || "Hover over a row to inspect its contribution.");
  container.append(insight);
  for (const item of items) {
    const row = document.createElement(actionable ? "button" : "div");
    row.className = `analytics-bar-row ${options.kind || ""}`.trim();
    if (actionable) {
      row.type = "button";
      row.addEventListener("click", () => {
        if (options.kind === "category") openBoardFromAnalytics(item.key, "all");
        else if (options.kind === "action") openBoardFromAnalytics("all", item.key);
      });
    }
    const labelText = options.labels?.[item.key] || displayCategory(item.key);
    const explain = () => {
      insight.innerHTML = `<strong>${labelText}</strong> accounts for ${item.count.toLocaleString()} emails, or ${displayPercent(item.share)} of this view.${actionable ? " Click to inspect the supporting emails." : ""}`;
    };
    row.addEventListener("mouseenter", explain);
    row.addEventListener("focus", explain);
    const header = element("span", "analytics-bar-copy");
    header.append(
      element("strong", "", labelText),
      element("small", "", `${item.count.toLocaleString()} · ${displayPercent(item.share)}`),
    );
    const track = element("span", "analytics-bar-track");
    const fill = element("span", `analytics-bar-fill key-${item.key}`);
    fill.style.width = `${Math.max(item.count ? 2 : 0, item.share * 100)}%`;
    track.append(fill);
    row.append(header, track);
    container.append(row);
  }
}

function renderCategoryDistribution(items) {
  analyticsCategories.replaceChildren();
  const nonZero = items.filter((item) => item.count > 0);
  const maximum = Math.max(1, ...nonZero.map((item) => item.count));
  const insight = element("p", "analytics-chart-insight");
  const leader = [...nonZero].sort((left, right) => right.count - left.count)[0];
  insight.innerHTML = leader
    ? `<strong>${displayCategory(leader.key)}</strong> is the largest email pool at ${leader.count.toLocaleString()} messages (${displayPercent(leader.share)}). Select any column to open its evidence.`
    : "No category decisions are available yet.";
  const chart = element("div", "distribution-columns");
  for (const item of nonZero) {
    const label = displayCategory(item.key);
    const column = element("button", `distribution-column key-${item.key}`);
    column.type = "button";
    column.setAttribute("aria-label", `${label}: ${item.count.toLocaleString()} emails, ${displayPercent(item.share)}`);
    const plot = element("span", "distribution-column-plot");
    const bar = element("i", "distribution-column-bar");
    bar.style.height = `${Math.max(5, (item.count / maximum) * 100)}%`;
    bar.style.background = analyticsPalette[item.key] || analyticsPalette.other;
    plot.append(bar);
    column.append(
      element("strong", "", item.count.toLocaleString()),
      plot,
      element("span", "", label),
      element("small", "", displayPercent(item.share)),
    );
    const explain = () => {
      insight.innerHTML = `<strong>${label}</strong> contains ${item.count.toLocaleString()} emails (${displayPercent(item.share)}). Click to filter the Email Board to this category.`;
      chart.querySelectorAll(".distribution-column").forEach((node) => node.classList.toggle("is-highlighted", node === column));
    };
    column.addEventListener("mouseenter", explain);
    column.addEventListener("focus", explain);
    column.addEventListener("click", () => openBoardFromAnalytics(item.key, "all"));
    chart.append(column);
  }
  analyticsCategories.append(insight, chart);
}

function renderConfidenceDonut(items) {
  analyticsConfidence.replaceChildren();
  const colors = items.map((item) => analyticsPalette[item.key] || analyticsPalette.not_available);
  let cursor = 0;
  const stops = items.map((item, index) => {
    const start = cursor;
    cursor += item.share * 100;
    return `${colors[index]} ${start}% ${cursor}%`;
  });
  const high = items.find((item) => item.key === "high");
  const donut = element("div", "confidence-donut");
  donut.style.background = `conic-gradient(${stops.join(", ")})`;
  const center = element("span", "confidence-donut-center");
  center.append(element("strong", "", displayPercent(high?.share || 0)), element("small", "", "high confidence"));
  donut.append(center);
  const legend = element("div", "confidence-legend");
  const insight = element("p", "analytics-chart-insight", "High-confidence decisions have at least 80% top-category probability.");
  for (const item of items) {
    const label = item.key === "high" ? "High · 80%+" : item.key === "medium" ? "Medium · 60–79%" : item.key === "low" ? "Low · under 60%" : "Not available";
    const row = element("button", "confidence-legend-row");
    row.type = "button";
    const dot = element("i", "");
    dot.style.background = analyticsPalette[item.key] || analyticsPalette.not_available;
    row.append(dot, element("span", "", label), element("strong", "", `${item.count.toLocaleString()} · ${displayPercent(item.share)}`));
    const explain = () => { insight.innerHTML = `<strong>${label}</strong> contains ${item.count.toLocaleString()} decisions (${displayPercent(item.share)}).`; };
    row.addEventListener("mouseenter", explain);
    row.addEventListener("focus", explain);
    legend.append(row);
  }
  const visual = element("div", "confidence-visual-grid");
  visual.append(donut, legend);
  analyticsConfidence.append(visual, insight);
}

function renderAnalyticsActivity(activity) {
  analyticsActivity.replaceChildren();
  const maximum = Math.max(1, ...activity.map((item) => item.count));
  const total = activity.reduce((sum, item) => sum + item.count, 0);
  document.querySelector("#analyticsActivityTotal").textContent = `${total.toLocaleString()} emails`;
  const width = 1000;
  const height = 210;
  const pad = { left: 34, right: 18, top: 20, bottom: 30 };
  const x = (index) => pad.left + (index / Math.max(1, activity.length - 1)) * (width - pad.left - pad.right);
  const y = (count) => height - pad.bottom - (count / maximum) * (height - pad.top - pad.bottom);
  const points = activity.map((item, index) => `${x(index)},${y(item.count)}`).join(" ");
  const area = `${pad.left},${height - pad.bottom} ${points} ${x(activity.length - 1)},${height - pad.bottom}`;
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `Thirty day email activity, ${total} emails total` });
  const defs = svgElement("defs");
  const gradient = svgElement("linearGradient", { id: "activityGradient", x1: "0", y1: "0", x2: "0", y2: "1" });
  gradient.append(svgElement("stop", { offset: "0%", "stop-color": "#315efb", "stop-opacity": ".28" }), svgElement("stop", { offset: "100%", "stop-color": "#315efb", "stop-opacity": ".02" }));
  defs.append(gradient);
  svg.append(defs, svgElement("polygon", { points: area, fill: "url(#activityGradient)" }), svgElement("polyline", { points, class: "activity-line" }));
  const guide = svgElement("line", { class: "activity-guide", y1: pad.top, y2: height - pad.bottom });
  guide.hidden = true;
  svg.append(guide);
  const tooltip = element("div", "analytics-tooltip");
  tooltip.hidden = true;
  activity.forEach((item, index) => {
    const circle = svgElement("circle", { cx: x(index), cy: y(item.count), r: 4, class: "activity-point" });
    const hit = svgElement("rect", {
      x: x(index) - (width / activity.length) / 2,
      y: pad.top,
      width: width / activity.length,
      height: height - pad.top - pad.bottom,
      fill: "transparent",
      tabindex: "0",
      role: "button",
      "aria-label": `${item.date}: ${item.count} emails`,
    });
    const show = () => {
      guide.hidden = false;
      guide.setAttribute("x1", String(x(index)));
      guide.setAttribute("x2", String(x(index)));
      tooltip.hidden = false;
      tooltip.style.left = `${(x(index) / width) * 100}%`;
      tooltip.innerHTML = `<strong>${item.count.toLocaleString()} emails</strong><span>${new Date(`${item.date}T00:00:00Z`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>`;
      svg.querySelectorAll(".activity-point").forEach((node) => node.classList.toggle("is-active", node === circle));
    };
    hit.addEventListener("mouseenter", show);
    hit.addEventListener("focus", show);
    svg.append(circle, hit);
  });
  analyticsActivity.addEventListener("mouseleave", () => { guide.hidden = true; tooltip.hidden = true; });
  analyticsActivity.append(svg, tooltip);
}

function renderAnalyticsBenchmark(benchmark) {
  analyticsBenchmark.replaceChildren();
  if (!benchmark) {
    analyticsBenchmark.append(element("p", "analytics-empty", "No current held-out benchmark is available. Run npm run jev:evaluate."));
    return;
  }
  document.querySelector("#analyticsBenchmarkVersion").textContent = benchmark.classifier_version || "Current classifier";
  const metrics = [
    ["Raw accuracy", displayPercent(benchmark.raw_accuracy)],
    ["Automatic accuracy", displayPercent(benchmark.automatic_accuracy)],
    ["Automatic coverage", displayPercent(benchmark.automatic_coverage)],
    ["Evaluation tokens", benchmark.total_input_tokens.toLocaleString()],
  ];
  const grid = element("div", "quality-grid");
  for (const [label, value] of metrics) {
    const metric = element("div", "quality-metric");
    metric.append(element("span", "", label), element("strong", "", value));
    grid.append(metric);
  }
  analyticsBenchmark.append(grid);
  if (benchmark.top_confusions.length) {
    analyticsBenchmark.append(element("h4", "", "Largest confusions"));
    const list = element("div", "confusion-list");
    for (const item of benchmark.top_confusions) {
      list.append(element("span", "", `${displayCategory(item.expected)} → ${displayCategory(item.predicted)} · ${item.count}`));
    }
    analyticsBenchmark.append(list);
  }
}

function renderAnalyticsRuns(runs) {
  analyticsRuns.replaceChildren();
  document.querySelector("#analyticsRunCount").textContent = `${runs.length} runs`;
  if (!runs.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = "No durable classification runs yet.";
    row.append(cell);
    analyticsRuns.append(row);
    return;
  }
  for (const run of runs) {
    const row = document.createElement("tr");
    const identity = document.createElement("td");
    identity.append(
      element("strong", "", run.classifier_version),
      element("small", "", new Date(run.created_at).toLocaleString()),
    );
    const status = element("td", "");
    status.append(element("span", `run-status status-${run.status}`, displayCategory(run.status)));
    const values = [
      run.processed_count.toLocaleString(),
      run.failure_rate === null ? "—" : displayPercent(run.failure_rate),
      run.processed_count ? displayPercent(run.uncertain_count / run.processed_count) : "—",
      run.duration_seconds === null ? "—" : formatDuration(run.duration_seconds),
      run.throughput_per_second === null ? "—" : `${run.throughput_per_second.toFixed(1)}/sec`,
      run.input_tokens ? run.input_tokens.toLocaleString() : "—",
    ];
    row.append(identity, status, ...values.map((value) => element("td", "", value)));
    analyticsRuns.append(row);
  }
}

function renderAnalyticsNarrative(snapshot) {
  analyticsNarrative.replaceChildren();
  const categories = new Map(snapshot.category_breakdown.map((item) => [item.key, item]));
  const lifecycle = snapshot.application_lifecycle;
  const statuses = new Map((lifecycle?.status_breakdown || []).map((item) => [item.status, item.count]));
  const totalApplications = Number(lifecycle?.application_count || 0);
  const activeProgress = Number(statuses.get("reply_needed") || 0) + Number(statuses.get("interview_assessment") || 0) + Number(statuses.get("offer") || 0);
  const cards = [
    {
      icon: "◎",
      label: "Mailbox shape",
      title: `${displayPercent(categories.get("applied")?.share || 0)} application confirmations`,
      body: `${Number(categories.get("applied")?.count || 0).toLocaleString()} classified emails confirm an application was received.`,
    },
    {
      icon: "→",
      label: "Action pressure",
      title: `${snapshot.summary.needs_action.toLocaleString()} emails need action`,
      body: `${snapshot.summary.drafts_recommended.toLocaleString()} currently recommend a written reply; use Action backlog to open the exact messages.`,
    },
    {
      icon: "↗",
      label: "Pipeline movement",
      title: totalApplications ? `${displayPercent(activeProgress / totalApplications)} actively progressed` : "No application data yet",
      body: totalApplications
        ? `${activeProgress.toLocaleString()} of ${totalApplications.toLocaleString()} applications are awaiting a reply, in assessment/interview, or at offer.`
        : "Publish application outputs to calculate lifecycle movement.",
    },
  ];
  for (const item of cards) {
    const card = element("article", "analytics-insight-card");
    card.append(
      element("span", "analytics-insight-icon", item.icon),
      element("small", "", item.label),
      element("strong", "", item.title),
      element("p", "", item.body),
    );
    analyticsNarrative.append(card);
  }
}

function renderAnalytics(snapshot) {
  analyticsCards.replaceChildren();
  const classified = Math.max(1, snapshot.summary.classified_emails);
  analyticsMetric("Classified emails", snapshot.summary.classified_emails.toLocaleString(), "Current effective board records");
  analyticsMetric("Needs action", snapshot.summary.needs_action.toLocaleString(), `${snapshot.summary.drafts_recommended.toLocaleString()} replies recommended`, "warning", snapshot.summary.needs_action / classified);
  analyticsMetric("Uncertain", displayPercent(snapshot.summary.uncertain_rate), `${snapshot.summary.uncertain.toLocaleString()} emails below threshold`, "uncertain", snapshot.summary.uncertain_rate);
  analyticsMetric("Human corrections", snapshot.summary.human_corrections.toLocaleString(), `${snapshot.summary.human_disagreements.toLocaleString()} changed Jev decisions`, "human", snapshot.summary.human_corrections / classified);
  renderAnalyticsNarrative(snapshot);
  renderAnalyticsActivity(snapshot.activity);
  document.querySelector("#analyticsCategoryTotal").textContent = `${snapshot.summary.classified_emails.toLocaleString()} emails`;
  document.querySelector("#analyticsActionTotal").textContent = `${snapshot.summary.needs_action.toLocaleString()} actionable`;
  document.querySelector("#analyticsConfidenceTotal").textContent = `${snapshot.summary.uncertain.toLocaleString()} uncertain`;
  renderCategoryDistribution(snapshot.category_breakdown);
  renderAnalyticsBars(analyticsActions, snapshot.action_breakdown, {
    kind: "action",
    labels: { not_available: "Not available", no_action: "No action" },
    defaultInsight: "Hover over an action to see its workload; click to open those emails.",
  });
  renderConfidenceDonut(snapshot.confidence_breakdown);
  renderAnalyticsBenchmark(snapshot.benchmark);
  renderAnalyticsRuns(snapshot.runs);
  renderLifecycleSankey(snapshot.application_lifecycle);
}

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

function renderLifecycleSankey(lifecycle) {
  lifecycleSankey.replaceChildren();
  const empty = document.querySelector("#lifecycleEmpty");
  const count = lifecycle?.application_count || 0;
  document.querySelector("#lifecycleApplicationCount").textContent = `${count.toLocaleString()} applications`;
  const flows = lifecycle?.flows || [];
  if (!lifecycle || !count || !flows.length) {
    lifecycleSankey.hidden = true;
    empty.hidden = false;
    return;
  }
  if (!window.d3?.sankey || !window.d3?.sankeyLinkHorizontal) {
    lifecycleSankey.hidden = false;
    empty.hidden = true;
    const message = document.createElement("p");
    message.className = "analytics-empty";
    message.textContent = "The Sankey layout library could not be loaded.";
    lifecycleSankey.append(message);
    return;
  }
  lifecycleSankey.hidden = false;
  empty.hidden = true;
  const statusOrder = ["outreach", "applied", "reply_needed", "interview_assessment", "offer", "rejected", "ghosted"];
  const labels = {
    all_applications: "All applications",
    outreach: "Outreach",
    applied: "Applied",
    reply_needed: "Reply needed",
    interview_assessment: "Interview / assessment",
    offer: "Offer",
    rejected: "Rejected",
    ghosted: "Ghosted",
  };
  const statusCounts = new Map(lifecycle.status_breakdown.map((item) => [item.status, item.count]));
  const nodes = [
    { id: "all_applications", count },
    ...statusOrder
      .filter((status) => (statusCounts.get(status) || 0) > 0)
      .map((status) => ({ id: status, count: statusCounts.get(status) || 0 })),
  ];
  const chartWidth = Math.max(440, Math.min(1100, window.innerWidth - 50));
  const sourceX = chartWidth < 650 ? 125 : 190;
  const targetX = chartWidth < 650 ? chartWidth - 180 : chartWidth - 210;
  const graph = window.d3.sankey()
    .nodeId((node) => node.id)
    .nodeWidth(22)
    .nodePadding(30)
    .nodeAlign(window.d3.sankeyJustify)
    .nodeSort((left, right) => statusOrder.indexOf(left.id) - statusOrder.indexOf(right.id))
    .extent([[sourceX, 34], [targetX, 506]])({
      nodes: nodes.map((node) => ({ ...node })),
      links: flows.map((flow) => ({ source: flow.source, target: flow.target, value: flow.count })),
    });
  const svg = svgElement("svg", { viewBox: `0 0 ${chartWidth} 540`, role: "img", "aria-labelledby": "sankeyTitle sankeyDescription" });
  const title = svgElement("title", { id: "sankeyTitle" });
  title.textContent = "All applications split by current status";
  const description = svgElement("desc", { id: "sankeyDescription" });
  description.textContent = `${count} total applications flow into current-status pools. Each application belongs to exactly one pool.`;
  svg.append(title, description);

  const linkPath = window.d3.sankeyLinkHorizontal();
  for (const link of graph.links) {
    const status = link.target.id;
    const linkGroup = svgElement("g", { class: "sankey-link" });
    const path = svgElement("path", {
      class: `sankey-ribbon status-${status}`,
      d: linkPath(link),
      "stroke-width": Math.max(1, link.width),
    });
    const pathTitle = svgElement("title");
    pathTitle.textContent = `${labels[status]}: ${link.value.toLocaleString()} of ${count.toLocaleString()} applications`;
    path.append(pathTitle);
    const hitPath = svgElement("path", {
      class: "sankey-hit",
      d: linkPath(link),
      "stroke-width": Math.max(18, link.width),
      role: "button",
      tabindex: "0",
      "aria-label": pathTitle.textContent,
    });
    const openPool = () => openApplicationsFromAnalytics(status);
    hitPath.addEventListener("click", openPool);
    hitPath.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openPool();
    });
    linkGroup.append(path, hitPath);
    svg.append(linkGroup);
  }

  for (const node of graph.nodes) {
    const isTotal = node.id === "all_applications";
    const nodeCount = isTotal ? count : statusCounts.get(node.id) || 0;
    const group = svgElement("g", {
      class: `sankey-node ${isTotal ? "sankey-total" : `status-${node.id}`}`,
      role: "button",
      tabindex: "0",
      "aria-label": `${labels[node.id]}: ${nodeCount.toLocaleString()} applications`,
    });
    const rectangle = svgElement("rect", {
      x: node.x0,
      y: node.y0,
      width: node.x1 - node.x0,
      height: Math.max(1, node.y1 - node.y0),
      rx: 3,
    });
    const textX = isTotal ? node.x0 - 14 : node.x1 + 14;
    const textY = (node.y0 + node.y1) / 2;
    const label = svgElement("text", { x: textX, y: textY - 4, "text-anchor": isTotal ? "end" : "start" });
    label.textContent = labels[node.id];
    const value = svgElement("text", { class: "sankey-value", x: textX, y: textY + 13, "text-anchor": isTotal ? "end" : "start" });
    const percentage = count ? (nodeCount / count) * 100 : 0;
    const displayedPercentage = percentage > 0 && percentage < 1 ? percentage.toFixed(1) : Math.round(percentage).toString();
    value.textContent = isTotal ? `${nodeCount.toLocaleString()} total` : `${nodeCount.toLocaleString()} · ${displayedPercentage}%`;
    group.append(rectangle, label, value);
    const openPool = () => openApplicationsFromAnalytics(isTotal ? "all" : node.id);
    group.addEventListener("click", openPool);
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openPool();
    });
    svg.append(group);
  }
  lifecycleSankey.append(svg);
  lifecycleSankey.scrollLeft = 0;
}

function openApplicationsFromAnalytics(status = "all") {
  applicationStatus.value = status;
  currentApplicationId = null;
  navigateToBoard("applications");
}

async function loadAnalytics() {
  analyticsStatus.hidden = false;
  analyticsStatus.classList.remove("error");
  analyticsStatus.textContent = "Loading live mailbox analytics…";
  analyticsContent.hidden = true;
  try {
    const response = await fetch("/api/analytics", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load analytics");
    renderAnalytics(payload);
    analyticsStatus.hidden = true;
    analyticsContent.hidden = false;
  } catch (error) {
    analyticsStatus.classList.add("error");
    analyticsStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

const applicationStatuses = ["outreach", "applied", "reply_needed", "interview_assessment", "offer", "rejected", "ghosted"];

function applicationCard(application) {
  const card = element("button", "application-card");
  card.type = "button";
  card.classList.toggle("active", application.id === currentApplicationId);
  const company = element("strong", "", application.company || "Unknown company");
  const role = element("span", "application-role", application.role || application.latest_subject || "Role not extracted");
  const meta = element("small", "", `${application.message_count} email${application.message_count === 1 ? "" : "s"} · ${new Date(application.last_activity_at).toLocaleDateString()}`);
  if (application.actionable_count) meta.textContent += ` · ${application.actionable_count} action${application.actionable_count === 1 ? "" : "s"}`;
  card.append(company, role, meta);
  card.addEventListener("click", () => void loadApplicationDetail(application.id));
  return card;
}

function renderApplicationBoard() {
  applicationBoard.replaceChildren();
  applicationCount.textContent = `${applications.length.toLocaleString()} application${applications.length === 1 ? "" : "s"}`;
  for (const status of applicationStatuses) {
    const lane = element("section", `application-lane status-${status}`);
    const laneApplications = applications.filter((application) => application.current_status === status);
    const heading = element("header", "application-lane-heading");
    heading.append(element("strong", "", displayCategory(status)), element("span", "", laneApplications.length.toLocaleString()));
    const cards = element("div", "application-lane-cards");
    if (!laneApplications.length) cards.append(element("p", "board-lane-empty", "No applications"));
    else for (const application of laneApplications) cards.append(applicationCard(application));
    lane.append(heading, cards);
    applicationBoard.append(lane);
  }
}

function timelineItem(event) {
  const item = element("li", `timeline-item status-${event.status}`);
  const marker = element("span", "timeline-marker");
  const copy = element("div", "");
  copy.append(
    element("strong", "", displayCategory(event.status)),
    element("small", "", `${new Date(event.event_at).toLocaleString()} · ${displayCategory(event.source)}`),
    element("p", "", event.explanation || "Lifecycle evidence"),
  );
  item.append(marker, copy);
  return item;
}

function renderApplicationDetail(payload) {
  const application = payload.application;
  applicationDetail.replaceChildren();
  const header = element("header", "application-detail-header");
  const badges = element("div", "badges");
  badges.append(element("span", `badge category-${application.current_status}`, displayCategory(application.current_status)));
  if (application.grouping_source === "manual") badges.append(element("span", "badge human", "Manually reviewed"));
  header.append(
    badges,
    element("h3", "", application.company || "Unknown company"),
    element("p", "application-detail-role", application.role || "Role not extracted"),
    element("p", "board-email-meta", `${payload.messages.length} email${payload.messages.length === 1 ? "" : "s"} · ${new Date(application.first_activity_at).toLocaleDateString()}–${new Date(application.last_activity_at).toLocaleDateString()}${application.requisition_id ? ` · ${application.requisition_id}` : ""}`),
  );
  applicationDetail.append(header);

  const timeline = element("section", "application-detail-section");
  timeline.append(element("h4", "", "Lifecycle evidence"));
  const eventList = element("ol", "application-timeline");
  for (const event of payload.events) eventList.append(timelineItem(event));
  timeline.append(eventList);
  applicationDetail.append(timeline);

  const evidence = element("section", "application-detail-section");
  evidence.append(element("h4", "", "Email evidence"));
  const messageList = element("div", "application-messages");
  for (const message of payload.messages) {
    const link = element("a", "application-message");
    link.href = `https://mail.google.com/mail/u/0/#all/${message.gmail_message_id}`;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.append(
      element("strong", "", message.subject || "(no subject)"),
      element("span", "", `${displayCategory(message.effective_category)} · ${new Date(message.internal_date).toLocaleString()}`),
      element("small", "", message.snippet || "Open in Gmail"),
    );
    messageList.append(link);
  }
  evidence.append(messageList);
  applicationDetail.append(evidence);

  const editor = element("form", "application-editor application-detail-section");
  editor.append(element("h4", "", "Review application"));
  const labeledField = (labelText, control) => {
    const label = element("label", "application-field");
    label.append(element("span", "", labelText), control);
    return label;
  };
  const company = document.createElement("input");
  company.value = application.company || "";
  company.placeholder = "Company";
  const role = document.createElement("input");
  role.value = application.role || "";
  role.placeholder = "Role";
  const requisition = document.createElement("input");
  requisition.value = application.requisition_id || "";
  requisition.placeholder = "Requisition ID";
  const status = document.createElement("select");
  for (const value of applicationStatuses) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = displayCategory(value);
    option.selected = value === application.current_status;
    status.append(option);
  }
  const notes = document.createElement("textarea");
  notes.rows = 3;
  notes.placeholder = "Why did you change this application?";
  notes.value = application.manual_notes || "";
  const save = element("button", "button primary", "Save application");
  save.type = "submit";
  const saveStatus = element("p", "resample-status");
  editor.append(
    labeledField("Company", company),
    labeledField("Role", role),
    labeledField("Requisition ID", requisition),
    labeledField("Lifecycle status", status),
    labeledField("Review notes", notes),
    save,
    saveStatus,
  );
  editor.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    saveStatus.classList.remove("error");
    saveStatus.textContent = "Saving…";
    try {
      const response = await fetch("/api/applications/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: application.id,
          company: company.value,
          role: role.value,
          requisition_id: requisition.value,
          current_status: status.value,
          notes: notes.value,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save application");
      saveStatus.textContent = "Application and lifecycle history saved.";
      await loadApplications();
      await loadApplicationDetail(application.id);
    } catch (error) {
      saveStatus.classList.add("error");
      saveStatus.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      save.disabled = false;
    }
  });
  applicationDetail.append(editor);
}

async function loadApplicationDetail(applicationId) {
  currentApplicationId = applicationId;
  renderApplicationBoard();
  applicationDetail.replaceChildren(element("p", "board-empty", "Loading application evidence…"));
  try {
    const response = await fetch(`/api/applications/detail?id=${encodeURIComponent(applicationId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load application");
    renderApplicationDetail(payload);
  } catch (error) {
    applicationDetail.replaceChildren(element("p", "board-empty error", error instanceof Error ? error.message : String(error)));
  }
}

async function loadApplications() {
  try {
    const rows = [];
    let offset = 0;
    let payload;
    do {
      const response = await fetch(`/api/applications?limit=1000&offset=${offset}&status=${encodeURIComponent(applicationStatus.value)}`, { cache: "no-store" });
      payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load applications");
      rows.push(...(payload.applications || []));
      offset += payload.applications?.length || 0;
    } while (payload.has_more && payload.applications?.length);
    applications = rows;
    if (!applications.some((application) => application.id === currentApplicationId)) {
      currentApplicationId = null;
      applicationDetail.replaceChildren(element("p", "board-empty", "Choose an application to inspect its lifecycle and email evidence."));
    }
    renderApplicationBoard();
  } catch (error) {
    applicationBoard.replaceChildren(element("p", "board-empty error", error instanceof Error ? error.message : String(error)));
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
  return {
    scope: "unclassified",
    maximum: null,
    after: null,
    before: null,
    minimum_top_probability: 0.6,
    concurrency: 5,
    batch_size: 25,
  };
}

function selectPipelineStep(step) {
  selectedPipelineStep = step;
  for (const card of pipelineSteps) {
    const selected = card.dataset.pipelineStep === step;
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  }
  for (const detail of pipelineDetails) {
    const selected = detail.dataset.stepDetail === step;
    detail.hidden = !selected;
    detail.classList.toggle("is-visible", selected);
  }
  const copy = {
    ingestion: ["Step 1 · Gmail intake", "Resume the mailbox safely", "Only changes after the saved Gmail history cursor are requested, normalized, and stored."],
    classification: ["Step 2 · Jev decisions", "Classify in fast, durable batches", "Each email passes through the same Choice, Score, and Noul judgments before landing in one visible outcome."],
    outputs: ["Step 3 · Product outputs", "Publish one result set everywhere", "The completed production corpus powers the Email Board, grouped Applications, and the Analytics Sankey."],
  }[step];
  pipelineDetailKicker.textContent = copy[0];
  pipelineDetailTitle.textContent = copy[1];
  pipelineDetailSummary.textContent = copy[2];
  if (latestCommandSnapshot) renderPipelineDetail(latestCommandSnapshot);
}

function renderPipelineDetail(snapshot) {
  const mailbox = snapshot.mailbox || {};
  const ingestion = snapshot.ingestion;
  const outputs = snapshot.outputs;
  const runs = snapshot.runs || [];
  const activeRun = runs.find((run) => run.status === "queued" || run.status === "running");
  const displayRun = activeRun || runs.find((run) => run.status === "succeeded") || runs[0] || {};
  const ingestionCounts = ingestion?.result?.counts || ingestion?.stats || (snapshot.sync_runs || [])[0] || {};
  flowGmailCount.textContent = ingestion?.status === "running"
    ? `${Number(ingestionCounts.pending || 0).toLocaleString()} changes remaining`
    : `${Number(ingestionCounts.inserted_count ?? ingestionCounts.inserted ?? 0).toLocaleString()} new last sync`;
  flowStoredCount.textContent = `${Number(mailbox.active_emails || 0).toLocaleString()} stored emails`;
  flowWaitingCount.textContent = `${Number(mailbox.unclassified_emails || 0).toLocaleString()} waiting`;
  flowClassifiedCount.textContent = `${Number(mailbox.classified_emails || 0).toLocaleString()} emails`;
  flowApplicationCount.textContent = `${Number(mailbox.application_count || 0).toLocaleString()} grouped jobs`;

  const ingestionStage = String(ingestion?.stats?.stage || (ingestion?.status === "succeeded" ? "complete" : "idle"));
  flowIngestionStage.textContent = displayCategory(ingestionStage);
  flowPages.textContent = Number(ingestionCounts.page || 0).toLocaleString();
  flowIteration.textContent = Number(ingestionCounts.iteration || 0).toLocaleString();
  flowDiscovered.textContent = Number(ingestionCounts.discovered ?? ingestionCounts.discovered_count ?? 0).toLocaleString();
  flowExisting.textContent = Number(ingestionCounts.existing || 0).toLocaleString();
  flowPending.textContent = Number(ingestionCounts.pending || 0).toLocaleString();
  flowInserted.textContent = Number(ingestionCounts.inserted ?? ingestionCounts.inserted_count ?? 0).toLocaleString();
  flowUpdated.textContent = Number(ingestionCounts.updated ?? ingestionCounts.updated_count ?? 0).toLocaleString();
  flowSkipped.textContent = Number(ingestionCounts.skipped ?? ingestionCounts.skipped_count ?? 0).toLocaleString();
  flowDeleted.textContent = Number(ingestionCounts.deleted ?? ingestionCounts.deleted_count ?? 0).toLocaleString();

  const ingestionStageMap = {
    starting: "gmail",
    catching_up: "gmail",
    discovering: "gmail",
    comparing: "normalize",
    fetching: "normalize",
    finalizing: "store",
  };
  document.querySelectorAll("[data-ingestion-stage]").forEach((node) => {
    const isRunning = ingestion?.status === "queued" || ingestion?.status === "running";
    node.classList.toggle("is-stage-active", isRunning && node.dataset.ingestionStage === ingestionStageMap[ingestionStage]);
    node.classList.toggle("is-stage-complete", ingestion?.status === "succeeded");
  });

  flowRunStatus.textContent = displayCategory(displayRun.status || "idle");
  flowRunTotal.textContent = Number(displayRun.total_count || 0).toLocaleString();
  flowRunProcessed.textContent = Number(displayRun.processed_count || 0).toLocaleString();
  flowRunSucceeded.textContent = Number(displayRun.succeeded_count || 0).toLocaleString();
  flowRunFailed.textContent = Number(displayRun.failed_count || 0).toLocaleString();
  flowRunUncertain.textContent = Number(displayRun.uncertain_count || 0).toLocaleString();
  document.querySelectorAll("[data-classification-stage]").forEach((node) => {
    const stage = node.dataset.classificationStage;
    const activeStage = activeRun?.status === "queued" ? "batch" : activeRun?.status === "running" ? "jev" : null;
    node.classList.toggle("is-stage-active", stage === activeStage);
    node.classList.toggle("is-stage-complete", !activeRun && displayRun.status === "succeeded");
  });

  const outputBlocked = ingestion?.status === "queued" || ingestion?.status === "running" || Boolean(activeRun) || Number(mailbox.unclassified_emails || 0) > 0;
  const progress = outputBlocked ? 0 : Number(outputs?.progress_percent ?? (Number(mailbox.application_count || 0) > 0 ? 100 : 0));
  const outputStageMap = {
    queued: "classified",
    loading_classifications: "classified",
    checking_thread_relationships: "classified",
    grouping_applications: "board",
    saving_applications: "applications",
    refreshing_links: "applications",
    building_analytics: "analytics",
    complete: "analytics",
  };
  const activeOutputStage = outputStageMap[outputs?.stage || "complete"];
  const outputOrder = ["classified", "board", "applications", "analytics"];
  const activeOutputIndex = outputOrder.indexOf(activeOutputStage);
  document.querySelectorAll("[data-output-stage]").forEach((node) => {
    const nodeIndex = outputOrder.indexOf(node.dataset.outputStage);
    node.classList.toggle("is-stage-active", !outputBlocked && (outputs?.status === "queued" || outputs?.status === "running") ? node.dataset.outputStage === activeOutputStage : false);
    node.classList.toggle("is-stage-complete", !outputBlocked && (outputs?.status === "succeeded" || (!outputs && progress === 100) || (activeOutputIndex >= 0 && nodeIndex < activeOutputIndex)));
  });
  flowOutputStage.textContent = displayCategory(outputBlocked ? "waiting" : outputs?.stage || (progress === 100 ? "complete" : "waiting"));
  flowOutputPercent.textContent = `${Math.round(progress)}%`;
  flowOutputEmails.textContent = Number(outputs?.result?.classified_email_count ?? mailbox.classified_emails ?? 0).toLocaleString();
  flowOutputApplications.textContent = Number(outputs?.result?.application_count ?? mailbox.application_count ?? 0).toLocaleString();
  flowOutputCorrections.textContent = Number(mailbox.human_corrected_emails || 0).toLocaleString();
}

function setPipelineStepState(step, badge, status) {
  step.classList.toggle("is-running", status === "queued" || status === "running");
  step.classList.toggle("is-complete", status === "succeeded");
  step.classList.toggle("is-error", status === "failed" || status === "partial");
  badge.className = `pipeline-state ${status || "waiting"}`;
  badge.textContent = status ? displayCategory(status) : "Waiting";
}

function renderCommandPipeline(snapshot) {
  latestCommandSnapshot = snapshot;
  const mailbox = snapshot.mailbox || {};
  const account = snapshot.account || {};
  const automation = snapshot.automation || {};
  const ingestion = snapshot.ingestion;
  const outputs = snapshot.outputs;
  const latestSync = (snapshot.sync_runs || [])[0];
  const runs = snapshot.runs || [];
  const activeRun = runs.find((run) => run.status === "queued" || run.status === "running");
  // Prefer the newest successful production result over a later cancelled retry.
  // The cancelled run remains visible in run history, but it must not replace the
  // corpus currently published to the board and analytics workspaces.
  const latestRun = runs.find((run) => run.status === "succeeded") || runs[0];
  const ingestionStatus = ingestion?.status || latestSync?.status || null;
  const ingestionRunning = ingestionStatus === "queued" || ingestionStatus === "running";
  const classificationRunning = Boolean(activeRun);

  automationHealth.className = `automation-health ${automation.last_automation_status || (automation.migration_ready ? "ready" : "unavailable")}`;
  if (!automation.migration_ready) {
    automationHealthTitle.textContent = "Automation migration required";
    automationHealthDetail.textContent = "Apply migration 007 before starting the hourly scheduler.";
    automationHealthMetric.textContent = "Setup needed";
  } else if (automation.last_automation_status === "running") {
    automationHealthTitle.textContent = "Scheduled pipeline is running";
    automationHealthDetail.textContent = `Started ${new Date(automation.last_automation_started_at).toLocaleString()}. Manual controls are temporarily locked.`;
    automationHealthMetric.textContent = "In progress";
  } else if (automation.last_automation_status === "failed") {
    automationHealthTitle.textContent = "Last scheduled cycle failed";
    automationHealthDetail.textContent = automation.last_automation_error || "Inspect server logs for the failed stage.";
    automationHealthMetric.textContent = automation.last_automation_completed_at ? new Date(automation.last_automation_completed_at).toLocaleString() : "Needs attention";
  } else if (automation.last_automation_status === "succeeded") {
    const metrics = automation.last_automation_metrics || {};
    automationHealthTitle.textContent = "Hourly pipeline healthy";
    automationHealthDetail.textContent = `${Number(metrics.emails_inserted || 0).toLocaleString()} new · ${Number(metrics.emails_classified || 0).toLocaleString()} classified · ${Number(metrics.applications_published || 0).toLocaleString()} applications`;
    automationHealthMetric.textContent = automation.last_automation_completed_at ? `Last run ${new Date(automation.last_automation_completed_at).toLocaleString()}` : "Healthy";
  } else {
    automationHealthTitle.textContent = "Hourly automation ready";
    automationHealthDetail.textContent = automation.enabled ? `Configured every ${Number(automation.interval_minutes || 60)} minutes; waiting for its first cycle.` : "Run npm run scheduler or deploy automate:once as an hourly job.";
    automationHealthMetric.textContent = automation.enabled ? "Enabled" : "Manual mode";
  }

  commandAccount.textContent = account.gmail_address || "Connected mailbox";
  commandMailboxCount.textContent = Number(mailbox.active_emails || 0).toLocaleString();
  commandUnclassifiedCount.textContent = Number(mailbox.unclassified_emails || 0).toLocaleString();
  commandClassifiedCount.textContent = Number(mailbox.classified_emails || 0).toLocaleString();
  commandCorrectionCount.textContent = Number(mailbox.human_corrected_emails || 0).toLocaleString();
  commandBoardCount.textContent = Number(mailbox.classified_emails || 0).toLocaleString();
  commandApplicationCount.textContent = Number(mailbox.application_count || 0).toLocaleString();

  const ingestionCounts = ingestion?.result?.counts || ingestion?.stats || (latestSync ? {
    inserted: latestSync.inserted_count,
    updated: latestSync.updated_count,
    discovered: latestSync.discovered_count,
    pending: 0,
  } : {});
  commandNewCount.textContent = Number(ingestionCounts.inserted || 0).toLocaleString();
  commandUpdatedCount.textContent = Number(ingestionCounts.updated || 0).toLocaleString();
  commandIngestionMessage.textContent = ingestion?.message || (latestSync
    ? `Last ${displayCategory(latestSync.sync_type)} sync ${latestSync.status} ${new Date(latestSync.started_at).toLocaleString()}.`
    : "Check Gmail for new incoming and sent messages. Drafts remain excluded.");
  const discovered = Number(ingestionCounts.discovered || 0);
  const pending = Number(ingestionCounts.pending || 0);
  const ingestionPercent = ingestionRunning
    ? discovered > 0 ? Math.max(5, ((discovered - pending) / discovered) * 100) : 5
    : ingestionStatus === "succeeded" ? 100 : 0;
  commandIngestionProgress.style.width = `${Math.min(100, ingestionPercent)}%`;
  setPipelineStepState(ingestionStep, commandIngestionState, ingestionStatus);

  const runForDisplay = activeRun || latestRun;
  commandRunProgress.textContent = runForDisplay
    ? `${Number(runForDisplay.processed_count || 0).toLocaleString()}/${Number(runForDisplay.total_count || 0).toLocaleString()}`
    : "No run";
  commandRunProgressLabel.textContent = activeRun ? "current run" : "last run";
  const unclassifiedCount = Number(mailbox.unclassified_emails || 0);
  const activeRunTotal = Number(activeRun?.total_count || 0);
  const classificationPercent = ingestionRunning
    ? 0
    : activeRun && activeRunTotal > 0
      ? (Number(activeRun.processed_count || 0) / activeRunTotal) * 100
      : unclassifiedCount === 0 ? 100 : 0;
  commandClassificationProgress.style.width = `${Math.min(100, classificationPercent)}%`;
  const classificationStatus = ingestionRunning ? null : activeRun?.status || (unclassifiedCount === 0 ? "succeeded" : null);
  setPipelineStepState(classificationStep, commandClassificationState, classificationStatus);

  const outputWaiting = ingestionRunning || classificationRunning || unclassifiedCount > 0;
  const outputStatus = outputWaiting ? null : outputs?.status || (Number(mailbox.application_count || 0) > 0 ? "succeeded" : null);
  setPipelineStepState(outputStep, commandOutputState, outputStatus);
  const outputPercent = outputWaiting ? 0 : Number(outputs?.progress_percent ?? (outputStatus === "succeeded" ? 100 : outputStatus === "queued" ? 5 : 0));
  commandOutputProgress.style.width = `${Math.max(0, Math.min(100, outputPercent))}%`;

  const automationRunning = automation.last_automation_status === "running" && automation.pipeline_lock_id;
  syncNewEmails.disabled = ingestionRunning || classificationRunning || automationRunning;
  syncNewEmails.textContent = ingestionRunning ? "Syncing Gmail…" : "Sync new emails";
  startCommandClassification.disabled = ingestionRunning || classificationRunning || automationRunning || Number(mailbox.unclassified_emails || 0) === 0;
  startCommandClassification.textContent = classificationRunning
    ? "Jev classification running…"
    : Number(mailbox.unclassified_emails || 0) === 0
      ? "Everything is classified"
      : `Classify ${Number(mailbox.unclassified_emails || 0).toLocaleString()} emails`;
  const outputRunning = outputs?.status === "queued" || outputs?.status === "running";
  refreshCommandOutputs.disabled = ingestionRunning || classificationRunning || automationRunning || unclassifiedCount > 0 || outputRunning || Number(mailbox.classified_emails || 0) === 0;
  refreshCommandOutputs.textContent = outputRunning ? "Publishing outputs…" : "Publish latest results";
  if (outputs?.status === "failed" && outputs.error) {
    commandStatus.textContent = `Output refresh failed: ${outputs.error}`;
    commandStatus.classList.add("error");
  } else if (outputs?.status === "succeeded" && outputs.result) {
    commandStatus.classList.remove("error");
    commandStatus.textContent = `Published ${Number(outputs.result.classified_email_count || 0).toLocaleString()} classified emails into ${Number(outputs.result.application_count || 0).toLocaleString()} applications. Email Board and Analytics now use this result set.`;
  }
  renderPipelineDetail(snapshot);
}

async function publishCommandOutputs() {
  selectPipelineStep("outputs");
  commandStatus.classList.remove("error");
  commandStatus.textContent = "Publishing Email Board results, rebuilding Applications, and refreshing Analytics…";
  refreshCommandOutputs.disabled = true;
  if (latestCommandSnapshot) {
    latestCommandSnapshot.outputs = { status: "queued", stage: "queued", progress_percent: 3 };
    renderCommandPipeline(latestCommandSnapshot);
  }
  try {
    const response = await fetch("/api/command/publish", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not publish pipeline outputs");
    if (latestCommandSnapshot) {
      latestCommandSnapshot.outputs = result.outputs;
      renderCommandPipeline(latestCommandSnapshot);
    }
    commandStatus.textContent = "Output refresh is running in the background. Counts update automatically.";
  } catch (error) {
    commandStatus.textContent = error instanceof Error ? error.message : String(error);
    commandStatus.classList.add("error");
  } finally {
    await loadCommandRuns();
  }
}

async function startGmailSync() {
  selectPipelineStep("ingestion");
  commandStatus.classList.remove("error");
  commandStatus.textContent = "Starting incremental Gmail sync…";
  syncNewEmails.disabled = true;
  if (latestCommandSnapshot) {
    latestCommandSnapshot.ingestion = {
      status: "queued",
      message: "Queued Gmail incremental sync",
      stats: { stage: "starting", page: 0, iteration: 0, discovered: 0, existing: 0, pending: 0, inserted: 0, updated: 0, skipped: 0, deleted: 0 },
    };
    latestCommandSnapshot.outputs = null;
    renderCommandPipeline(latestCommandSnapshot);
  }
  try {
    const response = await fetch("/api/command/ingest", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not start Gmail ingestion");
    commandStatus.textContent = "Gmail sync is running in the background. New-email counts update here automatically.";
  } catch (error) {
    commandStatus.textContent = error instanceof Error ? error.message : String(error);
    commandStatus.classList.add("error");
  } finally {
    await loadCommandRuns();
  }
}

async function loadCommandRuns() {
  try {
    const response = await fetch("/api/command/status", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load classification runs");
    renderCommandPipeline(result);
  } catch (error) {
    commandStatus.textContent = error instanceof Error ? error.message : String(error);
    commandStatus.classList.add("error");
  }
}

async function startCommandRun() {
  selectPipelineStep("classification");
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
    for (const tab of labTabs) {
      tab.addEventListener("click", () => navigateToLab(tab.dataset.labMode));
    }
    for (const tab of boardTabs) {
      tab.addEventListener("click", () => navigateToBoard(tab.dataset.boardMode));
    }
    window.addEventListener("hashchange", applyRouteFromHash);
    document.querySelector("#refreshBenchmark").addEventListener("click", () => void loadBenchmark());
    benchmarkFilter.addEventListener("change", renderBenchmarkRows);
    benchmarkScope.addEventListener("change", () => void loadBenchmark());
    document.querySelector("#refreshCommand").addEventListener("click", () => void loadCommandRuns());
    syncNewEmails.addEventListener("click", () => void startGmailSync());
    startCommandClassification.addEventListener("click", () => void startCommandRun());
    refreshCommandOutputs.addEventListener("click", () => void publishCommandOutputs());
    for (const step of pipelineSteps) {
      const activate = () => selectPipelineStep(step.dataset.pipelineStep);
      step.addEventListener("click", activate);
      step.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    }
    document.querySelector("#refreshBattleground").addEventListener("click", () => void loadBattleground());
    battlegroundForm.addEventListener("submit", (event) => void startBattleground(event));
    document.querySelector("#refreshBoard").addEventListener("click", () => void loadBoard());
    boardCategory.addEventListener("change", () => {
      boardCurrentEmailId = null;
      void loadBoard();
    });
    boardAction.addEventListener("change", () => {
      boardCurrentEmailId = null;
      void loadBoard();
    });
    document.querySelector("#refreshAnalytics").addEventListener("click", () => void loadAnalytics());
    document.querySelector("#refreshApplications").addEventListener("click", () => void loadApplications());
    applicationStatus.addEventListener("change", () => {
      currentApplicationId = null;
      void loadApplications();
    });
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
    applyRouteFromHash();
  } catch (error) {
    app.hidden = true;
    errorState.hidden = false;
    errorMessage.textContent = error instanceof Error ? error.message : String(error);
  }
}

initialize();
