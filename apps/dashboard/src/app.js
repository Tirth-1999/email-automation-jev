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
const aiSwitch = document.querySelector("#aiSwitch");
const aiTabs = [...document.querySelectorAll("[data-ai-mode]")];
const subnavHosts = {
  labels: document.querySelector("#labLabelsNavHost"),
  quality: document.querySelector("#labQualityNavHost"),
  performance: document.querySelector("#labPerformanceNavHost"),
  emails: document.querySelector("#boardEmailsNavHost"),
  applications: document.querySelector("#boardApplicationsNavHost"),
  brain: document.querySelector("#aiBrainNavHost"),
  chat: document.querySelector("#aiChatNavHost"),
};
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
const commandClassificationScope = document.querySelector("#commandClassificationScope");
const commandClassificationResultMode = document.querySelector("#commandClassificationResultMode");
const commandClassificationPolicy = document.querySelector("#commandClassificationPolicy");
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
const runCommandPipeline = document.querySelector("#runCommandPipeline");
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
const battlegroundDecisionPool = document.querySelector("#battlegroundDecisionPool");
const battlegroundCategoryHeatmap = document.querySelector("#battlegroundCategoryHeatmap");
const battlegroundPoolTooltip = document.querySelector("#battlegroundPoolTooltip");
const battlegroundHeatmapTooltip = document.querySelector("#battlegroundHeatmapTooltip");
const battlegroundDecisionLegend = document.querySelector("#battlegroundDecisionLegend");
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
const analyticsRange = document.querySelector("#analyticsRange");
const applicationsView = document.querySelector("#applicationsView");
const applicationStatus = document.querySelector("#applicationStatus");
const applicationBoard = document.querySelector("#applicationBoard");
const applicationCount = document.querySelector("#applicationCount");
const applicationDetail = document.querySelector("#applicationDetail");
const aiView = document.querySelector("#aiView");
const aiReviewQueue = document.querySelector("#aiReviewQueue");
const aiReviewDetail = document.querySelector("#aiReviewDetail");
const aiReviewCount = document.querySelector("#aiReviewCount");
const aiLaneSummary = document.querySelector("#aiLaneSummary");
const aiReviewModel = document.querySelector("#aiReviewModel");
const aiBrainWorkspace = document.querySelector("#aiBrainWorkspace");
const aiChatWorkspace = document.querySelector("#aiChatWorkspace");
const aiLaneSelect = document.querySelector("#aiLaneSelect");
const aiLaneScope = document.querySelector("#aiLaneScope");
const aiBrainMetrics = document.querySelector("#aiBrainMetrics");
const aiBatchProgress = document.querySelector("#aiBatchProgress");
const aiBatchStatus = document.querySelector("#aiBatchStatus");
const runAiLane = document.querySelector("#runAiLane");
const aiChatForm = document.querySelector("#aiChatForm");
const aiChatInput = document.querySelector("#aiChatInput");
const aiChatSend = document.querySelector("#aiChatSend");
const aiChatMessages = document.querySelector("#aiChatMessages");
const aiChatStatus = document.querySelector("#aiChatStatus");
const aiChatRouteState = document.querySelector("#aiChatRouteState");
const aiChatRecentList = document.querySelector("#aiChatRecentList");
const aiChatArchivedList = document.querySelector("#aiChatArchivedList");
const aiChatConversationTitle = document.querySelector("#aiChatConversationTitle");
const aiChatConversationId = document.querySelector("#aiChatConversationId");
const newAiChat = document.querySelector("#newAiChat");
const closeAiChat = document.querySelector("#closeAiChat");
const deleteAiChat = document.querySelector("#deleteAiChat");
const replyDialog = document.querySelector("#replyDialog");
const replyDialogTitle = document.querySelector("#replyDialogTitle");
const replySourceMeta = document.querySelector("#replySourceMeta");
const replySourceBody = document.querySelector("#replySourceBody");
const replyInstructions = document.querySelector("#replyInstructions");
const replyModel = document.querySelector("#replyModel");
const replySubject = document.querySelector("#replySubject");
const replyBody = document.querySelector("#replyBody");
const replyStreamStatus = document.querySelector("#replyStreamStatus");
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
let latestBattlegroundReport = null;
let battlegroundPoolHoverState = null;
let battlegroundHeatmapHoverState = [];
let boardEmails = [];
let boardLaneState = {};
let boardCurrentEmailId = null;
let boardReplyProfile = "";
let boardReplyReady = false;
let applications = [];
let applicationLaneState = {};
let currentApplicationId = null;
let currentLabMode = "quality";
let currentBoardMode = "emails";
let currentAiMode = "brain";
let selectedPipelineStep = "ingestion";
let latestCommandSnapshot = null;
let boardReplyModels = [];
let replyEmail = null;
let aiCandidates = [];
let aiCandidateTotal = 0;
let currentAiEmailId = null;
let aiBatchRunning = false;
let aiChatHistory = [];
let aiChatConversations = [];
let aiChatConversationIdValue = null;
let aiChatConversationArchived = false;
let aiChatLoaded = false;
let lastOutputCacheVersion = null;

// Keep tab switches instant without allowing operational polling to go stale.
// Successful mutations clear this cache; concurrent reads for the same URL
// share one promise so opening a page cannot duplicate Supabase work.
const apiResponseCache = new Map();
const apiRequestsInFlight = new Map();
const apiCacheTtl = new Map([
  ["/api/analytics", 60_000],
  ["/api/applications", 30_000],
  ["/api/board", 30_000],
  ["/api/ai/reviews", 30_000],
  ["/api/benchmark", 60_000],
  ["/api/labels", 15_000],
  ["/sample.json", 60_000],
]);

function responseFromCache(entry) {
  return new Response(entry.body, {
    status: entry.status,
    headers: { "Content-Type": entry.contentType || "application/json; charset=utf-8", "X-App-Cache": "HIT" },
  });
}

function cacheTtlForUrl(input) {
  const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
  for (const [prefix, ttl] of apiCacheTtl) {
    if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) return ttl;
  }
  return 0;
}

function invalidateApiCache() {
  apiResponseCache.clear();
}

async function apiFetch(input, init = {}) {
  const method = String(init.method || (typeof input === "string" ? "GET" : input.method) || "GET").toUpperCase();
  if (method !== "GET") {
    const response = await window.fetch(input, init);
    if (response.ok) invalidateApiCache();
    return response;
  }
  const ttl = cacheTtlForUrl(input);
  if (!ttl) return window.fetch(input, init);
  const url = new URL(typeof input === "string" ? input : input.url, window.location.href).toString();
  const cached = apiResponseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return responseFromCache(cached);
  const pending = apiRequestsInFlight.get(url);
  if (pending) return cached ? responseFromCache(cached) : responseFromCache(await pending);
  const request = window.fetch(input, { ...init, cache: "no-store" }).then(async (response) => {
    const entry = {
      status: response.status,
      contentType: response.headers.get("Content-Type"),
      body: await response.text(),
      expiresAt: Date.now() + ttl,
    };
    if (response.ok) apiResponseCache.set(url, entry);
    return entry;
  }).catch((error) => {
    if (cached) return cached;
    throw error;
  }).finally(() => apiRequestsInFlight.delete(url));
  apiRequestsInFlight.set(url, request);
  // Serve a previously loaded page immediately while its expired entry is
  // refreshed in the background. Mutations clear stale entries entirely.
  if (cached) return responseFromCache(cached);
  return responseFromCache(await request);
}

const categoryDescriptions = {
  applied: "Application received",
  outreach: "Outgoing message that initiates or follows up on a job conversation",
  reply_needed: "A written recruiter response or right-to-represent confirmation is required",
  information_needed: "Administrative form or missing application details, such as EEO or WOTC",
  interview_assessment: "Interview, test, or assessment",
  offer: "Offer or offer next step",
  rejected: "Explicit rejection",
  other: "Not part of the defined job-email categories",
  uncertain: "Not enough evidence",
};

const boardCategoryOrder = ["reply_needed", "information_needed", "interview_assessment", "offer", "applied", "outreach", "rejected", "other", "uncertain"];
const boardPageSize = 30;
const applicationPageSize = 30;

function displayCategory(category) {
  return category ? category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unclassified";
}

function displayPercent(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
}

function switchView(view, mode = null) {
  const labActive = view === "lab";
  const applicationBoardActive = view === "application_board";
  const aiActive = view === "ai";
  if (labActive && ["labels", "quality", "performance"].includes(mode)) currentLabMode = mode;
  if (applicationBoardActive && ["emails", "applications"].includes(mode)) currentBoardMode = mode;
  if (aiActive && ["brain", "chat"].includes(mode)) currentAiMode = mode;
  const benchmarkActive = labActive && currentLabMode === "quality";
  const reviewActive = labActive && currentLabMode === "labels";
  const commandActive = view === "command";
  const battlegroundActive = labActive && currentLabMode === "performance";
  const boardActive = applicationBoardActive && currentBoardMode === "emails";
  const analyticsActive = view === "analytics";
  const aiBrainActive = aiActive && currentAiMode === "brain";
  const aiChatActive = aiActive && currentAiMode === "chat";
  const applicationsActive = applicationBoardActive && currentBoardMode === "applications";
  if (labActive && subnavHosts[currentLabMode] && labSwitch.parentElement !== subnavHosts[currentLabMode]) {
    subnavHosts[currentLabMode].append(labSwitch);
  }
  if (applicationBoardActive && subnavHosts[currentBoardMode] && boardSwitch.parentElement !== subnavHosts[currentBoardMode]) {
    subnavHosts[currentBoardMode].append(boardSwitch);
  }
  if (aiActive && subnavHosts[currentAiMode] && aiSwitch.parentElement !== subnavHosts[currentAiMode]) {
    subnavHosts[currentAiMode].append(aiSwitch);
  }
  app.classList.toggle("benchmark-mode", !reviewActive);
  app.classList.toggle("lab-mode", labActive);
  app.classList.toggle("board-mode", applicationBoardActive);
  app.classList.toggle("ai-mode", aiActive);
  reviewSidebar.hidden = !reviewActive;
  reviewReader.hidden = !reviewActive;
  reviewClassifier.hidden = !reviewActive;
  benchmarkView.hidden = !benchmarkActive;
  commandView.hidden = !commandActive;
  battlegroundView.hidden = !battlegroundActive;
  boardView.hidden = !boardActive;
  analyticsView.hidden = !analyticsActive;
  aiView.hidden = !aiActive;
  aiBrainWorkspace.hidden = !aiBrainActive;
  aiChatWorkspace.hidden = !aiChatActive;
  applicationsView.hidden = !applicationsActive;
  labSwitch.hidden = !labActive;
  boardSwitch.hidden = !applicationBoardActive;
  aiSwitch.hidden = !aiActive;
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
  for (const tab of aiTabs) {
    const active = tab.dataset.aiMode === currentAiMode;
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
  if (aiBrainActive) void loadAiReviews();
  if (aiChatActive) void loadAiChatWorkspace();
}

function navigateToView(view) {
  const safeView = ["command", "application_board", "lab", "analytics", "ai"].includes(view) ? view : "command";
  if (safeView === "lab") {
    navigateToLab(currentLabMode);
    return;
  }
  if (safeView === "application_board") {
    navigateToBoard(currentBoardMode);
    return;
  }
  if (safeView === "ai") {
    navigateToAi(currentAiMode);
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

function navigateToAi(mode) {
  const safeMode = ["brain", "chat"].includes(mode) ? mode : "brain";
  const hash = `#ai-${safeMode}`;
  if (window.location.hash !== hash) window.location.hash = hash;
  else switchView("ai", safeMode);
}

function appendAiChatMessage(role, text, sql = "", route = null) {
  const message = element("article", `chat-message ${role}`);
  if (route) {
    const routeNames = { sql: "SQL lookup", conversation: "No tool", unsupported: "Outside scope" };
    const badge = element("span", `chat-route-badge ${route.route}`, routeNames[route.route] || route.route);
    const confidence = Number(route.confidence);
    if (Number.isFinite(confidence)) badge.title = `Jev route confidence ${(confidence * 100).toFixed(1)}%`;
    message.append(badge);
  }
  const content = element("div", "chat-message-content");
  if (role.startsWith("assistant") && /^(Result summary|Answer|Results|Key findings|Coverage)$/m.test(text)) {
    let list = null;
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line) {
        list = null;
        continue;
      }
      if (["Result summary", "Answer", "Results", "Key findings", "Coverage"].includes(line)) {
        content.append(element("h4", "", line));
        list = null;
      } else if (line.startsWith("• ")) {
        if (!list) {
          list = document.createElement("ul");
          content.append(list);
        }
        list.append(element("li", "", line.slice(2)));
      } else {
        content.append(element("p", "", line));
        list = null;
      }
    }
  } else {
    content.append(element("p", "", text));
  }
  message.append(content);
  if (sql) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "View generated SQL";
    const code = document.createElement("code");
    code.textContent = sql;
    details.append(summary, code);
    message.append(details);
  }
  aiChatMessages.append(message);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  return message;
}

function renderAiChatWelcome() {
  const welcome = element("section", "chat-welcome");
  welcome.append(
    element("div", "chat-welcome-icon", "J"),
    element("h3", "", "What do you want to know?"),
    element("p", "", "Ask naturally. I’ll query Supabase only when the answer actually depends on your mailbox."),
  );
  aiChatMessages.replaceChildren(welcome);
}

function setAiChatConversationState(conversation) {
  aiChatConversationIdValue = conversation?.id || null;
  aiChatConversationArchived = Boolean(conversation?.archived_at);
  aiChatConversationTitle.textContent = conversation?.title || "New chat";
  aiChatConversationId.textContent = conversation?.id
    ? `Chat ${conversation.id.slice(0, 8)} · ${aiChatConversationArchived ? "closed" : "saved in Supabase"}`
    : "Jev-routed · account scoped";
  closeAiChat.disabled = !conversation || aiChatConversationArchived;
  closeAiChat.textContent = aiChatConversationArchived ? "Closed" : "Close chat";
  closeAiChat.hidden = aiChatConversationArchived;
  deleteAiChat.hidden = !aiChatConversationArchived;
  aiChatInput.disabled = aiChatConversationArchived;
  aiChatSend.disabled = aiChatConversationArchived;
  aiChatInput.placeholder = aiChatConversationArchived
    ? "This chat is closed. Start a new chat to continue."
    : "Ask about applications, interviews, companies, or outcomes…";
}

function renderAiChatConversationList(target, conversations, archived) {
  target.replaceChildren();
  if (!conversations.length) {
    target.append(element("p", "", archived ? "No closed chats" : "No recent chats"));
    return;
  }
  for (const conversation of conversations) {
    const row = element("div", `chat-history-row${conversation.id === aiChatConversationIdValue ? " active" : ""}`);
    const select = element("button", "chat-history-select");
    select.type = "button";
    select.append(
      element("strong", "", conversation.title || "New chat"),
      element("small", "", conversation.id.slice(0, 8)),
    );
    select.addEventListener("click", () => void selectAiChatConversation(conversation.id).catch((error) => {
      aiChatStatus.textContent = error instanceof Error ? error.message : String(error);
    }));
    row.append(select);
    if (!archived) {
      const archive = element("button", "chat-history-close", "×");
      archive.type = "button";
      archive.title = "Close and archive chat";
      archive.addEventListener("click", () => void archiveAiChatConversation(conversation.id).catch((error) => {
        aiChatStatus.textContent = error instanceof Error ? error.message : String(error);
      }));
      row.append(archive);
    } else {
      const remove = element("button", "chat-history-delete", "Delete");
      remove.type = "button";
      remove.title = "Permanently delete chat";
      remove.addEventListener("click", () => void deleteAiChatConversation(conversation.id, conversation.title).catch((error) => {
        aiChatStatus.textContent = error instanceof Error ? error.message : String(error);
      }));
      row.append(remove);
    }
    target.append(row);
  }
}

function renderAiChatConversationLists() {
  renderAiChatConversationList(aiChatRecentList, aiChatConversations.filter((chat) => !chat.archived_at), false);
  renderAiChatConversationList(aiChatArchivedList, aiChatConversations.filter((chat) => chat.archived_at), true);
}

async function refreshAiChatConversations() {
  const response = await apiFetch("/api/ai/chats");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Could not load chats (${response.status})`);
  aiChatConversations = Array.isArray(payload.conversations) ? payload.conversations : [];
  renderAiChatConversationLists();
  return aiChatConversations;
}

async function createNewAiChat() {
  const response = await apiFetch("/api/ai/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Could not create chat (${response.status})`);
  await refreshAiChatConversations();
  await selectAiChatConversation(payload.conversation.id);
  return payload.conversation;
}

async function selectAiChatConversation(conversationId) {
  const response = await apiFetch(`/api/ai/chats/${encodeURIComponent(conversationId)}/messages`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Could not load chat (${response.status})`);
  setAiChatConversationState(payload.conversation);
  aiChatHistory = [];
  aiChatMessages.replaceChildren();
  for (const message of payload.messages || []) {
    const route = message.route ? { route: message.route, confidence: message.route_confidence } : null;
    appendAiChatMessage(message.role, message.content, message.generated_sql || "", route);
    aiChatHistory.push({ role: message.role, text: message.content });
  }
  if (!payload.messages?.length) renderAiChatWelcome();
  aiChatRouteState.textContent = aiChatConversationArchived ? "Closed" : "Ready";
  aiChatRouteState.className = "chat-route-state";
  aiChatStatus.textContent = aiChatConversationArchived
    ? "Read-only history · start a new chat to continue"
    : "Conversation history is saved in Supabase.";
  renderAiChatConversationLists();
}

async function archiveAiChatConversation(conversationId) {
  const response = await apiFetch(`/api/ai/chats/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archived: true }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Could not close chat (${response.status})`);
  const wasCurrent = conversationId === aiChatConversationIdValue;
  await refreshAiChatConversations();
  if (wasCurrent) await createNewAiChat();
}

async function deleteAiChatConversation(conversationId, title = "this chat") {
  if (!window.confirm(`Permanently delete “${title || "this chat"}” and its complete message history?`)) return;
  const response = await apiFetch(`/api/ai/chats/${encodeURIComponent(conversationId)}`, { method: "DELETE" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Could not delete chat (${response.status})`);
  const wasCurrent = conversationId === aiChatConversationIdValue;
  const conversations = await refreshAiChatConversations();
  if (wasCurrent) {
    const active = conversations.find((conversation) => !conversation.archived_at);
    if (active) await selectAiChatConversation(active.id);
    else await createNewAiChat();
  }
}

async function loadAiChatWorkspace() {
  if (aiChatLoaded) return;
  aiChatLoaded = true;
  try {
    const conversations = await refreshAiChatConversations();
    const active = conversations.find((conversation) => !conversation.archived_at);
    if (active) await selectAiChatConversation(active.id);
    else await createNewAiChat();
  } catch (error) {
    aiChatLoaded = false;
    aiChatStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function askAiChat(questionValue) {
  const question = String(questionValue || aiChatInput.value).trim();
  if (!question || aiChatSend.disabled) return;
  if (!aiChatConversationIdValue) {
    try {
      aiChatStatus.textContent = "Creating a saved chat…";
      await createNewAiChat();
    } catch (error) {
      aiChatRouteState.textContent = "Could not start";
      aiChatRouteState.className = "chat-route-state unsupported";
      aiChatStatus.textContent = error instanceof Error ? error.message : String(error);
      return;
    }
  }
  if (aiChatConversationArchived) return;
  aiChatMessages.querySelector(".chat-welcome")?.remove();
  appendAiChatMessage("user", question);
  aiChatHistory.push({ role: "user", text: question });
  aiChatInput.value = "";
  aiChatSend.disabled = true;
  aiChatInput.disabled = true;
  aiChatRouteState.textContent = "Jev is routing";
  aiChatRouteState.className = "chat-route-state routing";
  aiChatStatus.textContent = "Understanding whether this needs mailbox data…";
  const loading = appendAiChatMessage("assistant loading", "Thinking");
  try {
    const response = await apiFetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, conversation_id: aiChatConversationIdValue }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `AI Chat failed with status ${response.status}`);
    loading.remove();
    appendAiChatMessage("assistant", payload.answer, payload.sql, payload.route);
    aiChatHistory.push({ role: "assistant", text: payload.answer });
    aiChatConversationTitle.textContent = payload.conversation_title || aiChatConversationTitle.textContent;
    aiChatConversationId.textContent = `Chat ${payload.conversation_id.slice(0, 8)} · saved in Supabase`;
    await refreshAiChatConversations();
    const routeName = payload.route?.route || "conversation";
    aiChatRouteState.textContent = routeName === "sql" ? "SQL evidence" : routeName === "conversation" ? "No tool used" : "Outside scope";
    aiChatRouteState.className = `chat-route-state ${routeName}`;
    aiChatStatus.textContent = payload.tool_used
      ? `${payload.row_count} SQL result row${payload.row_count === 1 ? "" : "s"} used · ${payload.model}`
      : `Answered without querying Supabase · ${payload.model}`;
  } catch (error) {
    loading.remove();
    appendAiChatMessage("assistant error", error instanceof Error ? error.message : String(error));
    aiChatRouteState.textContent = "Could not complete";
    aiChatRouteState.className = "chat-route-state unsupported";
    aiChatStatus.textContent = "The request did not complete.";
  } finally {
    aiChatSend.disabled = false;
    aiChatInput.disabled = false;
    aiChatInput.focus();
  }
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
  const aiRoutes = { ai: "brain", "ai-brain": "brain", "ai-chat": "chat" };
  if (hash in aiRoutes) return { view: "ai", aiMode: aiRoutes[hash] };
  return { view: ["command", "analytics"].includes(hash) ? hash : "command" };
}

function applyRouteFromHash() {
  const route = routeFromHash();
  switchView(route.view, route.labMode || route.boardMode || route.aiMode);
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

const decisionPoolColors = {
  applied: "#31b76a",
  reply_needed: "#f59e42",
  information_needed: "#6366f1",
  interview_assessment: "#20a4c7",
  offer: "#087f5b",
  outreach: "#8b6ee8",
  rejected: "#e45b70",
  other: "#8793a5",
  uncertain: "#d6a522",
  failed: "#c93d4f",
  pending: "#e3e8ef",
};

function seededNumber(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function stringSeed(value) {
  let seed = 2166136261;
  for (const character of String(value || "decision-pool")) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function partitionDecisionHeatmap(items, x, y, width, height, boxes = []) {
  if (!items.length || width <= 0 || height <= 0) return boxes;
  if (items.length === 1) {
    boxes.push({ ...items[0], x, y, width, height });
    return boxes;
  }
  const total = items.reduce((sum, item) => sum + item.count, 0);
  let running = 0;
  let splitIndex = 1;
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < items.length; index += 1) {
    running += items[index - 1].count;
    const distance = Math.abs(total / 2 - running);
    if (distance < closest) {
      closest = distance;
      splitIndex = index;
    }
  }
  const first = items.slice(0, splitIndex);
  const second = items.slice(splitIndex);
  const firstTotal = first.reduce((sum, item) => sum + item.count, 0);
  const ratio = total ? firstTotal / total : 0.5;
  if (width >= height) {
    const firstWidth = width * ratio;
    partitionDecisionHeatmap(first, x, y, firstWidth, height, boxes);
    partitionDecisionHeatmap(second, x + firstWidth, y, width - firstWidth, height, boxes);
  } else {
    const firstHeight = height * ratio;
    partitionDecisionHeatmap(first, x, y, width, firstHeight, boxes);
    partitionDecisionHeatmap(second, x, y + firstHeight, width, height - firstHeight, boxes);
  }
  return boxes;
}

function renderBattlegroundDecisionMap(report = null) {
  const summary = report?.decision_summary || [];
  const visibleSummary = summary
    .filter((item) => Number(item.count || 0) > 0)
    .sort((left, right) => Number(right.count || 0) - Number(left.count || 0));
  const completed = visibleSummary.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const selected = Math.max(completed, Number(report?.selected_count || report?.config?.sampleSize || 0));
  battlegroundDecisionCount.textContent = selected
    ? `${completed.toLocaleString()} / ${selected.toLocaleString()} classified`
    : "0 decisions";
  battlegroundDecisionMap.classList.toggle("is-running", ["queued", "running"].includes(report?.status));
  const empty = battlegroundDecisionMap.querySelector(".decision-map-empty");
  empty.hidden = visibleSummary.length > 0;
  battlegroundDecisionLegend.replaceChildren();

  const heatmapItems = [];
  for (const item of visibleSummary) {
    heatmapItems.push({ category: item.category, count: Number(item.count || 0) });
    const key = document.createElement("span");
    key.className = "decision-pool-key";
    key.style.setProperty("--decision-color", decisionPoolColors[item.category] || decisionPoolColors.other);
    key.innerHTML = `<i></i>${displayCategory(item.category)} ${Number(item.count || 0).toLocaleString()}`;
    battlegroundDecisionLegend.append(key);
  }
  if (selected > completed) {
    heatmapItems.push({ category: "pending", count: selected - completed });
    const key = document.createElement("span");
    key.className = "decision-pool-key";
    key.style.setProperty("--decision-color", decisionPoolColors.pending);
    key.innerHTML = `<i></i>Waiting ${(selected - completed).toLocaleString()}`;
    battlegroundDecisionLegend.append(key);
  }

  const pool = [];
  const cellCount = Math.min(6_000, selected);
  let represented = 0;
  heatmapItems.forEach((item, index) => {
    const count = index === heatmapItems.length - 1
      ? Math.max(0, cellCount - represented)
      : Math.min(cellCount - represented, selected ? Math.round((item.count / selected) * cellCount) : 0);
    represented += count;
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) pool.push(item.category);
  });
  const random = seededNumber(stringSeed(report?.id));
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  const bounds = battlegroundDecisionMap.getBoundingClientRect();
  const width = Math.max(320, Math.round(bounds.width || 480));
  const height = Math.max(150, Math.round(bounds.height || 180));
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  battlegroundDecisionPool.width = width * ratio;
  battlegroundDecisionPool.height = height * ratio;
  const context = battlegroundDecisionPool.getContext("2d");
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  battlegroundPoolHoverState = null;
  if (pool.length) {
    const columns = Math.ceil(Math.sqrt(pool.length * (width / height)));
    const rows = Math.ceil(pool.length / columns);
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    battlegroundPoolHoverState = { pool, columns, rows, cellWidth, cellHeight, width, height };
    const gap = pool.length > 3_000 ? 0.7 : 1.1;
    pool.forEach((category, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      context.globalAlpha = category === "pending" ? 0.58 : 0.94;
      context.fillStyle = decisionPoolColors[category] || decisionPoolColors.other;
      context.fillRect(
        column * cellWidth + gap / 2,
        row * cellHeight + gap / 2,
        Math.max(0.8, cellWidth - gap),
        Math.max(0.8, cellHeight - gap),
      );
    });
  }
  context.globalAlpha = 1;

  const heatmapBounds = battlegroundCategoryHeatmap.getBoundingClientRect();
  const heatmapWidth = Math.max(240, Math.round(heatmapBounds.width || 320));
  const heatmapHeight = Math.max(150, Math.round(heatmapBounds.height || height));
  battlegroundCategoryHeatmap.width = heatmapWidth * ratio;
  battlegroundCategoryHeatmap.height = heatmapHeight * ratio;
  const heatmapContext = battlegroundCategoryHeatmap.getContext("2d");
  heatmapContext.scale(ratio, ratio);
  heatmapContext.clearRect(0, 0, heatmapWidth, heatmapHeight);
  battlegroundHeatmapHoverState = [];
  if (!heatmapItems.length) return;
  const boxes = partitionDecisionHeatmap(heatmapItems, 0, 0, heatmapWidth, heatmapHeight);
  battlegroundHeatmapHoverState = boxes.map((box) => ({ ...box, selected, heatmapWidth, heatmapHeight }));
  for (const box of boxes) {
    const gap = 3;
    const boxX = box.x + gap / 2;
    const boxY = box.y + gap / 2;
    const boxWidth = Math.max(0, box.width - gap);
    const boxHeight = Math.max(0, box.height - gap);
    const color = decisionPoolColors[box.category] || decisionPoolColors.other;
    const gradient = heatmapContext.createLinearGradient(boxX, boxY, boxX + boxWidth, boxY + boxHeight);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, `${color}cc`);
    heatmapContext.globalAlpha = box.category === "pending" ? 0.62 : 0.94;
    heatmapContext.fillStyle = gradient;
    heatmapContext.beginPath();
    heatmapContext.roundRect(boxX, boxY, boxWidth, boxHeight, Math.min(10, boxWidth / 8, boxHeight / 8));
    heatmapContext.fill();
    if (boxWidth < 68 || boxHeight < 38) continue;
    heatmapContext.save();
    heatmapContext.beginPath();
    heatmapContext.rect(boxX + 8, boxY + 8, Math.max(0, boxWidth - 16), Math.max(0, boxHeight - 16));
    heatmapContext.clip();
    heatmapContext.globalAlpha = 1;
    heatmapContext.fillStyle = box.category === "pending" ? "#465269" : "white";
    heatmapContext.font = "800 10px Inter, sans-serif";
    heatmapContext.fillText(displayCategory(box.category).toUpperCase(), boxX + 10, boxY + 20);
    heatmapContext.font = `800 ${boxWidth > 140 && boxHeight > 85 ? 25 : 18}px Inter, sans-serif`;
    heatmapContext.fillText(box.count.toLocaleString(), boxX + 10, boxY + (boxHeight > 72 ? 50 : 41));
    if (boxWidth > 120 && boxHeight > 82) {
      heatmapContext.font = "600 9px Inter, sans-serif";
      heatmapContext.globalAlpha = 0.88;
      heatmapContext.fillText(`${selected ? ((box.count / selected) * 100).toFixed(1) : "0.0"}% of outcomes`, boxX + 10, boxY + 67);
    }
    heatmapContext.restore();
  }
  heatmapContext.globalAlpha = 1;
}

function showCanvasTooltip(event, tooltip, category, detail) {
  const host = tooltip.parentElement;
  const bounds = host.getBoundingClientRect();
  tooltip.style.setProperty("--tooltip-color", decisionPoolColors[category] || decisionPoolColors.other);
  tooltip.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = displayCategory(category);
  const copy = document.createElement("span");
  copy.textContent = detail;
  tooltip.append(title, copy);
  tooltip.hidden = false;
  const left = Math.min(bounds.width - tooltip.offsetWidth - 8, Math.max(8, event.clientX - bounds.left + 12));
  const top = Math.min(bounds.height - tooltip.offsetHeight - 8, Math.max(8, event.clientY - bounds.top - tooltip.offsetHeight - 12));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function handleDecisionPoolHover(event) {
  const state = battlegroundPoolHoverState;
  if (!state) {
    battlegroundPoolTooltip.hidden = true;
    return;
  }
  const bounds = battlegroundDecisionPool.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * (state.width / bounds.width);
  const y = (event.clientY - bounds.top) * (state.height / bounds.height);
  const column = Math.min(state.columns - 1, Math.max(0, Math.floor(x / state.cellWidth)));
  const row = Math.min(state.rows - 1, Math.max(0, Math.floor(y / state.cellHeight)));
  const index = row * state.columns + column;
  const category = state.pool[index];
  if (!category) {
    battlegroundPoolTooltip.hidden = true;
    return;
  }
  showCanvasTooltip(event, battlegroundPoolTooltip, category, `Selected email ${index + 1} of ${state.pool.length.toLocaleString()}`);
}

function handleCategoryHeatmapHover(event) {
  const bounds = battlegroundCategoryHeatmap.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * ((battlegroundHeatmapHoverState[0]?.heatmapWidth || bounds.width) / bounds.width);
  const y = (event.clientY - bounds.top) * ((battlegroundHeatmapHoverState[0]?.heatmapHeight || bounds.height) / bounds.height);
  const box = battlegroundHeatmapHoverState.find((item) => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
  if (!box) {
    battlegroundHeatmapTooltip.hidden = true;
    return;
  }
  const percentage = box.selected ? ((box.count / box.selected) * 100).toFixed(1) : "0.0";
  showCanvasTooltip(event, battlegroundHeatmapTooltip, box.category, `${box.count.toLocaleString()} emails · ${percentage}% of outcomes`);
}

function renderBattleground(report) {
  latestBattlegroundReport = report;
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
      ? `Classifying ${completed}/${selected || report.config.sampleSize}.`
      : ""
  );
  renderBattlegroundDecisionMap(report);

  const metrics = report.metrics;
  const liveElapsedMs = report.started_at
    ? Math.max(0, Date.parse(report.finished_at || new Date().toISOString()) - Date.parse(report.started_at))
    : 0;
  const elapsedMs = Number(metrics?.wall_ms || liveElapsedMs);
  const liveRate = elapsedMs > 0 ? completed / (elapsedMs / 1_000) : 0;
  const successRate = completed
    ? Number(report.succeeded_count || 0) / completed
    : Number(metrics?.success_rate || 0);
  const throughput = Number(metrics?.throughput_per_second || liveRate);
  const successfulRate = Number(metrics?.successful_throughput_per_second || throughput * successRate);
  const totalInputTokens = Number(metrics?.total_input_tokens || (report.results || []).reduce((sum, result) => sum + Number(result.input_tokens || 0), 0));
  const estimatedCost = totalInputTokens * 0.042 / 1_000_000;
  battlegroundMetric("Emails read", `${completed.toLocaleString()} / ${selected.toLocaleString()}`, `${Math.max(0, selected - completed).toLocaleString()} still in the pool`);
  battlegroundMetric("Decisions written", Number(report.succeeded_count || 0).toLocaleString(), `${Number(report.failed_count || 0).toLocaleString()} failed`);
  battlegroundMetric("Success rate", displayPercent(successRate), `${metrics?.rate_limited_count || 0} HTTP 429 rate limits`);
  battlegroundMetric("Emails / sec", throughput.toFixed(0), `${successfulRate.toFixed(0)}/sec successful`);
  battlegroundMetric("Elapsed", formatMilliseconds(elapsedMs), metrics ? `p50 ${formatMilliseconds(metrics.p50_jev_ms)} · p95 ${formatMilliseconds(metrics.p95_jev_ms)}` : "Live wall-clock time");
  battlegroundMetric("Estimated cost", `$${estimatedCost < 0.01 ? estimatedCost.toFixed(4) : estimatedCost.toFixed(2)}`, `${totalInputTokens.toLocaleString()} input tokens · $0.042/MTok`);

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
    const response = await apiFetch("/api/battleground", { cache: "no-store" });
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
    const response = await apiFetch("/api/battleground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sample_size: Number(document.querySelector("#battlegroundSample").value),
        concurrency: Number(document.querySelector("#battlegroundConcurrency").value),
        minimum_top_probability: Number(document.querySelector("#battlegroundThreshold").value),
        max_retries: 0,
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
  const visibleCategories = boardCategory.value === "all"
    ? boardCategoryOrder
    : [boardCategory.value];
  const total = visibleCategories.reduce((sum, category) => sum + Number(boardLaneState[category]?.total || 0), 0);
  boardCount.textContent = `${total.toLocaleString()} emails · ${boardEmails.length.toLocaleString()} loaded`;
  for (const category of visibleCategories) {
    const state = boardLaneState[category] || { items: [], total: 0, hasMore: false, loading: true, error: null };
    const emails = state.items;
    const lane = element("section", `board-lane category-${category}`);
    const laneHeading = element("header", "board-lane-heading");
    laneHeading.append(
      element("strong", "", displayCategory(category)),
      element("span", "", state.loading && !emails.length ? "…" : Number(state.total || 0).toLocaleString()),
    );
    const cards = element("div", "board-lane-cards");
    if (state.error) cards.append(element("p", "board-lane-empty error", state.error));
    else if (state.loading && !emails.length) cards.append(element("p", "board-lane-empty", "Loading recent emails…"));
    else if (!emails.length) cards.append(element("p", "board-lane-empty", "No emails"));
    for (const email of emails) {
      const replyState = category === "reply_needed"
        ? email.reply_draft_status === "reviewed" ? " reply-reviewed" : email.reply_draft_status ? " reply-drafted" : " reply-waiting"
        : "";
      const button = element("button", `board-item${email.email_id === boardCurrentEmailId ? " active" : ""}${replyState}`);
      button.type = "button";
      button.append(
        element("strong", "", email.subject || "(no subject)"),
        element("small", "", [email.from_name, email.from_email].filter(Boolean).join(" · ") || "Unknown sender"),
        element("small", "board-card-meta", `${email.human_category ? "Human corrected" : "Jev"} · ${displayPercent(email.category_top_probability)}`),
      );
      if (category === "reply_needed") {
        button.append(element("span", "reply-state-label", email.reply_draft_status === "reviewed" ? "Reply ready" : email.reply_draft_status ? "Draft generated" : "No draft yet"));
        button.addEventListener("click", () => void openReplyWorkspace(email.email_id));
      } else {
        button.addEventListener("click", () => void loadBoardEmail(email.email_id));
      }
      cards.append(button);
    }
    if (state.hasMore) {
      const more = element("button", "lane-load-more", state.loading ? "Loading…" : `Load ${Math.min(boardPageSize, state.total - emails.length)} more`);
      more.type = "button";
      more.disabled = state.loading;
      more.addEventListener("click", () => void loadBoardLane(category, true));
      cards.append(more);
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
      const response = await apiFetch("/api/board/correction", {
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
        const response = await apiFetch("/api/board/draft", {
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
        const response = await apiFetch("/api/board/draft/save", {
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

function populateModelSelect(select, models, selected) {
  select.replaceChildren();
  for (const model of models) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    option.selected = model === selected;
    select.append(option);
  }
}

async function openReplyWorkspace(emailId) {
  replyStreamStatus.classList.remove("error");
  replyStreamStatus.textContent = "Loading saved context…";
  replyDialog.showModal();
  try {
    const response = await apiFetch(`/api/board/email?id=${encodeURIComponent(emailId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load email");
    replyEmail = payload.email;
    replyDialogTitle.textContent = replyEmail.subject || "(no subject)";
    replySourceMeta.textContent = `${[replyEmail.from_name, replyEmail.from_email].filter(Boolean).join(" · ") || "Unknown sender"} · ${new Date(replyEmail.internal_date).toLocaleString()}`;
    replySourceBody.textContent = replyEmail.body_text || replyEmail.snippet || "No readable body.";
    replyInstructions.value = replyEmail.reply_draft_instructions || boardReplyProfile;
    replySubject.value = replyEmail.reply_draft_subject || "";
    replyBody.value = replyEmail.reply_draft_body || "";
    populateModelSelect(replyModel, boardReplyModels.length ? boardReplyModels : ["gpt-4o-mini"], replyEmail.reply_draft_model);
    replyStreamStatus.textContent = replyEmail.reply_draft_status === "reviewed"
      ? "Reviewed draft restored. Nothing has been sent."
      : replyEmail.reply_draft_body ? "Saved draft restored." : "Ready to generate a new draft.";
  } catch (error) {
    replyStreamStatus.classList.add("error");
    replyStreamStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function generateStreamingReply() {
  if (!replyEmail) return;
  const button = document.querySelector("#generateReply");
  button.disabled = true;
  replyBody.value = "";
  replySubject.value = /^re:/i.test(replyEmail.subject || "") ? replyEmail.subject : `Re: ${replyEmail.subject || "Your email"}`;
  replyStreamStatus.classList.remove("error");
  replyStreamStatus.textContent = "GPT-4o Mini is drafting…";
  try {
    const response = await apiFetch("/api/board/draft/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_id: replyEmail.id, instructions: replyInstructions.value, model: replyModel.value }),
    });
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Could not generate reply");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "delta") replyBody.value += event.delta;
        if (event.type === "done") {
          replySubject.value = event.draft.subject;
          replyStreamStatus.textContent = `Draft saved with ${event.draft.model}. Review it before copying.`;
        }
        if (event.type === "error") throw new Error(event.error);
      }
      if (done) break;
    }
    await loadBoard(false);
  } catch (error) {
    replyStreamStatus.classList.add("error");
    replyStreamStatus.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
}

async function saveReplyDraft() {
  if (!replyEmail) return;
  const button = document.querySelector("#saveReply");
  button.disabled = true;
  try {
    const response = await apiFetch("/api/board/draft/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_id: replyEmail.id, subject: replySubject.value, body: replyBody.value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not save draft");
    replyStreamStatus.textContent = "Reviewed draft saved. Nothing was sent.";
    await loadBoard(false);
  } catch (error) {
    replyStreamStatus.classList.add("error");
    replyStreamStatus.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
}

async function loadBoardEmail(emailId) {
  boardCurrentEmailId = emailId;
  renderBoardList();
  boardDetail.replaceChildren(element("p", "board-empty", "Loading email context…"));
  try {
    const response = await apiFetch(`/api/board/email?id=${encodeURIComponent(emailId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load email");
    renderBoardDetail(payload.email);
  } catch (error) {
    boardDetail.replaceChildren(element("p", "board-empty error", error instanceof Error ? error.message : String(error)));
  }
}

function syncBoardEmails() {
  boardEmails = Object.values(boardLaneState).flatMap((state) => state.items || []);
}

async function loadBoardLane(category, append = false, renderImmediately = true) {
  const state = boardLaneState[category] || { items: [], total: 0, hasMore: false, loading: false, error: null };
  state.loading = true;
  state.error = null;
  boardLaneState[category] = state;
  if (renderImmediately) renderBoardList();
  try {
    const offset = append ? state.items.length : 0;
    const response = await apiFetch(`/api/board?limit=${boardPageSize}&offset=${offset}&category=${encodeURIComponent(category)}&action=${encodeURIComponent(boardAction.value)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Could not load ${displayCategory(category)}`);
    state.items = append ? [...state.items, ...(payload.emails || [])] : (payload.emails || []);
    state.total = Number(payload.total || 0);
    state.hasMore = Boolean(payload.has_more);
    boardReplyProfile = payload.reply_profile || boardReplyProfile;
    boardReplyReady = Boolean(payload.reply_provider_ready);
    boardReplyModels = payload.reply_models || boardReplyModels;
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
  } finally {
    state.loading = false;
    syncBoardEmails();
    if (renderImmediately) renderBoardList();
  }
}

async function loadBoard(selectFirst = false) {
  const categories = boardCategory.value === "all" ? boardCategoryOrder : [boardCategory.value];
  boardLaneState = Object.fromEntries(categories.map((category) => [category, { items: [], total: 0, hasMore: false, loading: true, error: null }]));
  boardEmails = [];
  renderBoardList();
  await Promise.all(categories.map((category) => loadBoardLane(category, false, false)));
  syncBoardEmails();
  renderBoardList();
  if (selectFirst && !boardCurrentEmailId && boardEmails[0]) await loadBoardEmail(boardEmails[0].email_id);
}

const analyticsPalette = {
  applied: "#315efb",
  outreach: "#7c3aed",
  reply_needed: "#ea580c",
  information_needed: "#6366f1",
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

function renderAnalyticsActivity(activity, period = { label: "Last 30 days", granularity: "day" }) {
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
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${period.label} email activity, ${total} emails total` });
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
      const dateLabel = new Date(`${item.date}T00:00:00Z`).toLocaleDateString([], period.granularity === "month"
        ? { month: "long", year: "numeric", timeZone: "UTC" }
        : { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
      tooltip.innerHTML = `<strong>${item.count.toLocaleString()} emails</strong><span>${dateLabel}</span>`;
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
  const activeProgress = Number(statuses.get("reply_needed") || 0) + Number(statuses.get("information_needed") || 0) + Number(statuses.get("interview_assessment") || 0) + Number(statuses.get("offer") || 0);
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
  const period = snapshot.period || { key: "30", label: "Last 30 days", granularity: "day" };
  document.querySelector("#analyticsActivityTitle").textContent = period.key === "all" ? "Monthly email activity" : `${period.key}-day email activity`;
  document.querySelector("#analyticsActivitySubtitle").textContent = period.granularity === "month"
    ? "Hover across the trend to inspect each month since your first tracked email"
    : "Hover across the trend to inspect any day";
  renderAnalyticsActivity(snapshot.activity, period);
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
  const statusOrder = ["outreach", "applied", "reply_needed", "information_needed", "interview_assessment", "offer", "rejected", "ghosted"];
  const labels = {
    all_applications: "All applications",
    outreach: "Outreach",
    applied: "Applied",
    reply_needed: "Reply needed",
    information_needed: "Information needed",
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
    const response = await apiFetch(`/api/analytics?range=${encodeURIComponent(analyticsRange.value)}`, { cache: "no-store" });
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

const applicationStatuses = ["reply_needed", "information_needed", "interview_assessment", "offer", "applied", "outreach", "rejected", "ghosted"];

function applicationCard(application) {
  const card = element("article", "application-card");
  card.classList.toggle("active", application.id === currentApplicationId);
  const open = element("button", "application-card-main");
  open.type = "button";
  const company = element("strong", "", application.company || "Unknown company");
  const role = element("span", "application-role", application.role || application.latest_subject || "Role not extracted");
  const meta = element("small", "", `${application.message_count} email${application.message_count === 1 ? "" : "s"} · ${new Date(application.last_activity_at).toLocaleDateString()}`);
  if (application.actionable_count) meta.textContent += ` · ${application.actionable_count} action${application.actionable_count === 1 ? "" : "s"}`;
  open.append(company, role, meta);
  open.addEventListener("click", () => void loadApplicationDetail(application.id));
  const star = element("button", `application-star${application.is_starred ? " active" : ""}`, application.is_starred ? "★" : "☆");
  star.type = "button";
  star.title = application.is_starred ? "Remove from Starred" : "Add to Starred";
  star.setAttribute("aria-label", star.title);
  star.addEventListener("click", async () => {
    star.disabled = true;
    try {
      const response = await apiFetch("/api/applications/star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: application.id, starred: !application.is_starred }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save star");
      for (const laneState of Object.values(applicationLaneState)) {
        for (const item of laneState.items || []) {
          if (item.id === application.id) {
            item.is_starred = payload.application.is_starred;
            item.starred_at = payload.application.starred_at;
          }
        }
      }
      const starred = applicationLaneState.starred;
      if (starred) {
        const existingIndex = starred.items.findIndex((item) => item.id === application.id);
        if (payload.application.is_starred && existingIndex < 0) {
          starred.items.unshift({ ...application, is_starred: true, starred_at: payload.application.starred_at });
          starred.total += 1;
        } else if (!payload.application.is_starred && existingIndex >= 0) {
          starred.items.splice(existingIndex, 1);
          starred.total = Math.max(0, starred.total - 1);
        }
        starred.hasMore = starred.items.length < starred.total;
      }
      syncApplications();
      renderApplicationBoard();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
      star.disabled = false;
    }
  });
  card.append(open, star);
  return card;
}

function renderApplicationBoard() {
  applicationBoard.replaceChildren();
  const statuses = applicationStatus.value === "all" ? ["starred", ...applicationStatuses] : [applicationStatus.value];
  const total = applicationStatus.value === "all"
    ? applicationStatuses.reduce((sum, status) => sum + Number(applicationLaneState[status]?.total || 0), 0)
    : Number(applicationLaneState[applicationStatus.value]?.total || 0);
  applicationCount.textContent = `${total.toLocaleString()} applications · ${applications.length.toLocaleString()} loaded`;
  for (const status of statuses) {
    const state = applicationLaneState[status] || { items: [], total: 0, hasMore: false, loading: true, error: null };
    const lane = element("section", `application-lane status-${status}`);
    const laneApplications = state.items;
    const heading = element("header", "application-lane-heading");
    heading.append(element("strong", "", status === "starred" ? "★ Starred" : displayCategory(status)), element("span", "", state.loading && !laneApplications.length ? "…" : Number(state.total || 0).toLocaleString()));
    const cards = element("div", "application-lane-cards");
    if (state.error) cards.append(element("p", "board-lane-empty error", state.error));
    else if (state.loading && !laneApplications.length) cards.append(element("p", "board-lane-empty", "Loading recent applications…"));
    else if (!laneApplications.length) cards.append(element("p", "board-lane-empty", status === "starred" ? "Star important applications to collect them here." : "No applications in this lane."));
    else for (const application of laneApplications) cards.append(applicationCard(application));
    if (state.hasMore) {
      const more = element("button", "lane-load-more", state.loading ? "Loading…" : `Load ${Math.min(applicationPageSize, state.total - laneApplications.length)} more`);
      more.type = "button";
      more.disabled = state.loading;
      more.addEventListener("click", () => void loadApplicationLane(status, true));
      cards.append(more);
    }
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
      const response = await apiFetch("/api/applications/update", {
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
    const response = await apiFetch(`/api/applications/detail?id=${encodeURIComponent(applicationId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load application");
    renderApplicationDetail(payload);
  } catch (error) {
    applicationDetail.replaceChildren(element("p", "board-empty error", error instanceof Error ? error.message : String(error)));
  }
}

function syncApplications() {
  const seen = new Set();
  applications = Object.values(applicationLaneState).flatMap((state) => state.items || []).filter((application) => {
    if (seen.has(application.id)) return false;
    seen.add(application.id);
    return true;
  });
}

async function loadApplicationLane(status, append = false, renderImmediately = true) {
  const state = applicationLaneState[status] || { items: [], total: 0, hasMore: false, loading: false, error: null };
  state.loading = true;
  state.error = null;
  applicationLaneState[status] = state;
  if (renderImmediately) renderApplicationBoard();
  try {
    const offset = append ? state.items.length : 0;
    const params = status === "starred"
      ? `starred=true`
      : `status=${encodeURIComponent(status)}`;
    const response = await apiFetch(`/api/applications?limit=${applicationPageSize}&offset=${offset}&${params}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Could not load ${displayCategory(status)} applications`);
    state.items = append ? [...state.items, ...(payload.applications || [])] : (payload.applications || []);
    state.total = Number(payload.total || 0);
    state.hasMore = Boolean(payload.has_more);
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
  } finally {
    state.loading = false;
    syncApplications();
    if (renderImmediately) renderApplicationBoard();
  }
}

async function loadApplications() {
  const statuses = applicationStatus.value === "all" ? ["starred", ...applicationStatuses] : [applicationStatus.value];
  applicationLaneState = Object.fromEntries(statuses.map((status) => [status, { items: [], total: 0, hasMore: false, loading: true, error: null }]));
  applications = [];
  renderApplicationBoard();
  await Promise.all(statuses.map((status) => loadApplicationLane(status, false, false)));
  syncApplications();
  renderApplicationBoard();
}

async function reviewAiCandidate(candidate) {
  const response = await apiFetch("/api/ai/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email_id: candidate.email_id, model: aiReviewModel.value }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "AI review failed");
  candidate.llm_review_input = payload.input;
  candidate.llm_review_output = payload.decision;
  candidate.llm_review_category = payload.decision.category;
  candidate.llm_review_confidence = payload.decision.confidence;
  candidate.llm_review_should_override = payload.decision.should_override_jev;
  candidate.llm_review_model = payload.model;
  candidate.llm_reviewed_at = payload.reviewed_at;
  return payload;
}

function laneAiCandidates() {
  return aiCandidates.filter((candidate) => candidate.effective_category === aiLaneSelect.value);
}

function renderAiBrainMetrics() {
  const rows = laneAiCandidates();
  const reviewed = rows.filter((candidate) => candidate.llm_reviewed_at);
  const reclassified = reviewed.filter((candidate) => candidate.llm_review_category && candidate.llm_review_category !== candidate.effective_category);
  const applicationIds = new Set(rows.map((candidate) => candidate.current_application_id).filter(Boolean));
  const alreadyGrouped = Math.max(0, rows.filter((candidate) => candidate.current_application_id).length - applicationIds.size);
  const relationships = reviewed.filter((candidate) => Number(candidate.llm_review_output?.relationship_confidence || 0) >= 0.85
    && candidate.llm_review_output?.related_application_id
    && candidate.llm_review_output.related_application_id !== candidate.current_application_id);
  const agreements = reviewed.filter((candidate) => candidate.llm_review_category === candidate.effective_category);
  aiBrainMetrics.replaceChildren();
  for (const [label, value] of [
    ["Lane emails", rows.length],
    ["Applications", applicationIds.size],
    ["Already grouped", alreadyGrouped],
    ["AI reviewed", reviewed.length],
    ["Reclassify", reclassified.length],
    ["Possible merges", relationships.length],
  ]) {
    const metric = element("article", "ai-brain-metric");
    metric.append(element("span", "", label), element("strong", "", Number(value).toLocaleString()));
    aiBrainMetrics.append(metric);
  }
  const pending = Math.max(0, rows.length - reviewed.length);
  if (!aiBatchRunning) aiBatchStatus.textContent = `${agreements.length.toLocaleString()} agreements · ${pending.toLocaleString()} awaiting AI`;
}

async function runAiLaneReview() {
  if (aiBatchRunning) return;
  const lane = aiLaneSelect.value;
  const allRows = laneAiCandidates();
  const rows = aiLaneScope.value === "pending" ? allRows.filter((candidate) => !candidate.llm_reviewed_at) : allRows;
  if (!rows.length) {
    aiBatchProgress.style.width = "100%";
    aiBatchStatus.textContent = aiLaneScope.value === "pending" ? "This lane has no pending AI reviews." : "This lane is empty.";
    return;
  }
  aiBatchRunning = true;
  runAiLane.disabled = true;
  aiLaneSelect.disabled = true;
  aiLaneScope.disabled = true;
  aiBatchStatus.classList.remove("error");
  let completed = 0;
  let failed = 0;
  let finalMessage = "";
  aiBatchProgress.style.width = "0%";
  aiBatchStatus.textContent = `Starting ${rows.length.toLocaleString()} ${displayCategory(lane)} reviews…`;
  const pending = [...rows];
  const worker = async () => {
    while (pending.length) {
      const candidate = pending.shift();
      try {
        await reviewAiCandidate(candidate);
      } catch {
        failed += 1;
      } finally {
        completed += 1;
        aiBatchProgress.style.width = `${(completed / rows.length) * 100}%`;
        aiBatchStatus.textContent = `${completed.toLocaleString()} / ${rows.length.toLocaleString()} reviewed${failed ? ` · ${failed} failed` : ""}`;
        renderAiReviewQueue();
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(3, rows.length) }, () => worker()));
    finalMessage = failed
      ? `Lane review completed with ${failed.toLocaleString()} failures.`
      : `Lane review complete: ${rows.length.toLocaleString()} decisions audited.`;
  } finally {
    aiBatchRunning = false;
    runAiLane.disabled = false;
    aiLaneSelect.disabled = false;
    aiLaneScope.disabled = false;
    renderAiReviewQueue();
    aiBatchStatus.classList.toggle("error", failed > 0);
    aiBatchStatus.textContent = finalMessage || `Lane review stopped after ${completed.toLocaleString()} decisions.`;
  }
}

function renderAiReviewDetail(candidate) {
  currentAiEmailId = candidate.email_id;
  aiReviewDetail.replaceChildren();
  const heading = element("div", "ai-review-heading");
  heading.append(
    element("span", `badge category-${candidate.effective_category}`, displayCategory(candidate.effective_category)),
    element("h3", "", candidate.subject || "(no subject)"),
    element("p", "", `${candidate.from_name || candidate.from_email || "Unknown sender"} · Jev ${displayPercent(candidate.category_top_probability)}`),
  );
  const run = element("button", "button primary", candidate.llm_reviewed_at ? "Run review again" : "Run structured AI review");
  run.type = "button";
  const status = element("p", "resample-status", candidate.llm_reviewed_at ? `Reviewed with ${candidate.llm_review_model}.` : "Not reviewed yet.");
  const input = element("pre", "ai-json", JSON.stringify(candidate.llm_review_input || {
    jev: { category: candidate.jev_decision, confidence: candidate.category_top_probability, next_action: candidate.next_action },
    email: { id: candidate.email_id, subject: candidate.subject, snippet: candidate.snippet },
  }, null, 2));
  const output = element("pre", "ai-json output", JSON.stringify(candidate.llm_review_output || { status: "Run the review to produce schema-validated output." }, null, 2));
  const contract = element("div", "ai-contract-grid");
  const inputPanel = element("section", "");
  inputPanel.append(element("h4", "", "Structured input"), input);
  const outputPanel = element("section", "");
  outputPanel.append(element("h4", "", "Structured output"), output);
  contract.append(inputPanel, outputPanel);
  run.addEventListener("click", async () => {
    run.disabled = true;
    status.classList.remove("error");
    status.textContent = "Reviewing category and application relationship…";
    try {
      await reviewAiCandidate(candidate);
      renderAiReviewQueue();
      renderAiReviewDetail(candidate);
    } catch (error) {
      status.classList.add("error");
      status.textContent = error instanceof Error ? error.message : String(error);
      run.disabled = false;
    }
  });
  aiReviewDetail.append(heading, run, status, contract);
  const relationship = candidate.llm_review_output;
  if (relationship?.related_application_id && Number(relationship.relationship_confidence || 0) >= 0.85) {
    const join = element("button", "button secondary", "Confirm and join this email");
    join.type = "button";
    join.addEventListener("click", async () => {
      join.disabled = true;
      try {
        const response = await apiFetch("/api/ai/relationship/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email_id: candidate.email_id, application_id: relationship.related_application_id }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not join email");
        status.textContent = "Email joined to the confirmed application.";
      } catch (error) {
        status.classList.add("error");
        status.textContent = error instanceof Error ? error.message : String(error);
        join.disabled = false;
      }
    });
    aiReviewDetail.append(join);
  }
}

function renderAiReviewQueue() {
  aiReviewQueue.replaceChildren();
  const reviewPriority = (candidate) => {
    const output = candidate.llm_review_output;
    if (output?.related_application_id && Number(output.relationship_confidence || 0) >= 0.85) return 3;
    if (candidate.llm_reviewed_at && candidate.llm_review_category !== candidate.effective_category) return 2;
    if (!candidate.llm_reviewed_at) return 1;
    return 0;
  };
  const visible = [...laneAiCandidates()].sort((left, right) => reviewPriority(right) - reviewPriority(left));
  aiReviewCount.textContent = `${visible.length.toLocaleString()} ${displayCategory(aiLaneSelect.value)} candidates`;
  aiLaneSummary.replaceChildren();
  for (const category of ["reply_needed", "information_needed", "interview_assessment", "offer"]) {
    const rows = aiCandidates.filter((candidate) => candidate.effective_category === category);
    const reviewed = rows.filter((candidate) => candidate.llm_reviewed_at).length;
    const summary = element("button", `ai-lane-card category-${category}${aiLaneSelect.value === category ? " active" : ""}`);
    summary.type = "button";
    summary.append(element("span", "", displayCategory(category)), element("strong", "", rows.length.toLocaleString()), element("small", "", `${reviewed} AI reviewed`));
    summary.addEventListener("click", () => {
      aiLaneSelect.value = category;
      currentAiEmailId = null;
      aiReviewDetail.replaceChildren(element("p", "board-empty", "Select an email to inspect its structured review."));
      renderAiReviewQueue();
    });
    aiLaneSummary.append(summary);
  }
  renderAiBrainMetrics();
  if (!visible.length) aiReviewQueue.append(element("p", "board-empty", "No decisions are currently in this lane."));
  for (const candidate of visible) {
    const button = element("button", `ai-review-row${candidate.email_id === currentAiEmailId ? " active" : ""}`);
    button.type = "button";
    button.append(
      element("span", `ai-review-dot${candidate.llm_reviewed_at ? " reviewed" : ""}`),
      element("strong", "", candidate.subject || "(no subject)"),
      element("small", "", `${displayCategory(candidate.effective_category)} · Jev ${displayPercent(candidate.category_top_probability)}`),
      element("em", "", candidate.llm_reviewed_at
        ? candidate.llm_review_output?.related_application_id && Number(candidate.llm_review_output?.relationship_confidence || 0) >= 0.85
          ? "Possible duplicate"
          : `${displayCategory(candidate.llm_review_category)} · ${displayPercent(Number(candidate.llm_review_confidence))}`
        : "Awaiting AI"),
    );
    button.addEventListener("click", () => {
      renderAiReviewQueue();
      renderAiReviewDetail(candidate);
    });
    aiReviewQueue.append(button);
  }
}

async function loadAiReviews() {
  aiReviewQueue.replaceChildren(element("p", "board-empty", "Loading targeted decisions…"));
  try {
    const response = await apiFetch("/api/ai/reviews?limit=500", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load AI reviews");
    aiCandidates = payload.candidates || [];
    aiCandidateTotal = Number(payload.total || aiCandidates.length);
    populateModelSelect(aiReviewModel, payload.models || ["gpt-4o-mini"], aiReviewModel.value);
    renderAiReviewQueue();
    if (currentAiEmailId) {
      const current = aiCandidates.find((candidate) => candidate.email_id === currentAiEmailId);
      if (current) renderAiReviewDetail(current);
    }
  } catch (error) {
    aiReviewQueue.replaceChildren(element("p", "board-empty error", error instanceof Error ? error.message : String(error)));
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
    const response = await apiFetch(`/api/benchmark?scope=${benchmarkScope.value}`, { cache: "no-store" });
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
  const fullMailbox = commandClassificationScope.value === "all";
  return {
    scope: fullMailbox ? "all" : "unclassified",
    replace_existing: fullMailbox && commandClassificationResultMode.value === "replace",
    maximum: null,
    after: null,
    before: null,
    minimum_top_probability: 0.6,
    concurrency: 5,
    batch_size: 25,
  };
}

function syncCommandClassificationOptions() {
  const fullMailbox = commandClassificationScope.value === "all";
  commandClassificationResultMode.disabled = !fullMailbox;
  if (!fullMailbox) commandClassificationResultMode.value = "preserve";
  commandClassificationPolicy.textContent = !fullMailbox
    ? "Existing classifications and corrections stay unchanged."
    : commandClassificationResultMode.value === "replace"
      ? "Fresh rebuild: old runs, classifications, and manual/AI overrides are cleared first. Drafts and stars remain."
      : "Every email is classified again; earlier runs remain auditable and current corrections stay active.";
  if (latestCommandSnapshot) renderCommandPipeline(latestCommandSnapshot);
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
  const progress = outputBlocked ? 0 : Number(outputs?.progress_percent ?? 0);
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
  const activeOutputStage = outputs ? outputStageMap[outputs.stage || "queued"] : null;
  const outputOrder = ["classified", "board", "applications", "analytics"];
  const activeOutputIndex = outputOrder.indexOf(activeOutputStage);
  document.querySelectorAll("[data-output-stage]").forEach((node) => {
    const nodeIndex = outputOrder.indexOf(node.dataset.outputStage);
    node.classList.toggle("is-stage-active", !outputBlocked && (outputs?.status === "queued" || outputs?.status === "running") ? node.dataset.outputStage === activeOutputStage : false);
    node.classList.toggle("is-stage-complete", !outputBlocked && Boolean(outputs) && (outputs?.status === "succeeded" || (activeOutputIndex >= 0 && nodeIndex < activeOutputIndex)));
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
  const pipeline = snapshot.pipeline;
  if (outputs?.status === "succeeded" && outputs.finished_at && outputs.finished_at !== lastOutputCacheVersion) {
    lastOutputCacheVersion = outputs.finished_at;
    invalidateApiCache();
  }
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
  const manualPipelineRunning = pipeline?.status === "queued" || pipeline?.status === "running";
  const activePipelineStep = {
    queued: "ingestion",
    ingestion: "ingestion",
    classification: "classification",
    publication: "outputs",
  }[pipeline?.stage];
  if (manualPipelineRunning && activePipelineStep && selectedPipelineStep !== activePipelineStep) {
    selectPipelineStep(activePipelineStep);
  } else if (!manualPipelineRunning && (outputs?.status === "queued" || outputs?.status === "running") && selectedPipelineStep !== "outputs") {
    selectPipelineStep("outputs");
  }

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
  const outputStatus = outputWaiting ? null : outputs?.status || null;
  setPipelineStepState(outputStep, commandOutputState, outputStatus);
  const outputPercent = outputWaiting ? 0 : Number(outputs?.progress_percent ?? (outputStatus === "succeeded" ? 100 : outputStatus === "queued" ? 5 : 0));
  commandOutputProgress.style.width = `${Math.max(0, Math.min(100, outputPercent))}%`;

  const automationRunning = automation.last_automation_status === "running" && automation.pipeline_lock_id;
  syncNewEmails.disabled = ingestionRunning || classificationRunning || automationRunning || manualPipelineRunning;
  syncNewEmails.textContent = ingestionRunning ? "Syncing Gmail…" : "Sync new emails";
  const fullMailboxRun = commandClassificationScope.value === "all";
  const replaceExisting = fullMailboxRun && commandClassificationResultMode.value === "replace";
  const selectedEmailCount = fullMailboxRun
    ? Number(mailbox.active_emails || 0)
    : Number(mailbox.unclassified_emails || 0);
  const classificationControlsLocked = ingestionRunning || classificationRunning || automationRunning || manualPipelineRunning;
  commandClassificationScope.disabled = classificationControlsLocked;
  commandClassificationResultMode.disabled = classificationControlsLocked || !fullMailboxRun;
  commandClassificationPolicy.textContent = !fullMailboxRun
    ? "Existing classifications and corrections stay unchanged."
    : replaceExisting
      ? "Fresh rebuild: old runs, classifications, and manual/AI overrides are cleared first. Drafts and stars remain."
      : "Every email is classified again; earlier runs remain auditable and current corrections stay active.";
  startCommandClassification.disabled = classificationControlsLocked || selectedEmailCount === 0;
  startCommandClassification.textContent = classificationRunning
    ? "Jev classification running…"
    : selectedEmailCount === 0
      ? "Everything is classified"
      : fullMailboxRun
        ? `${replaceExisting ? "Replace" : "Reclassify"} ${selectedEmailCount.toLocaleString()} emails`
        : `Classify ${selectedEmailCount.toLocaleString()} new emails`;
  const outputRunning = outputs?.status === "queued" || outputs?.status === "running";
  refreshCommandOutputs.disabled = ingestionRunning || classificationRunning || automationRunning || manualPipelineRunning || unclassifiedCount > 0 || outputRunning || Number(mailbox.classified_emails || 0) === 0;
  refreshCommandOutputs.textContent = outputRunning ? "Publishing outputs…" : "Publish latest results";
  runCommandPipeline.disabled = manualPipelineRunning || ingestionRunning || classificationRunning || outputRunning || automationRunning;
  runCommandPipeline.textContent = manualPipelineRunning ? "Pipeline running…" : "Run pipeline";
  if (outputs?.status === "failed" && outputs.error) {
    commandStatus.textContent = `Output refresh failed: ${outputs.error}`;
    commandStatus.classList.add("error");
  } else if (pipeline?.status === "failed") {
    commandStatus.textContent = `Pipeline failed: ${pipeline.error || "Unknown pipeline error"}`;
    commandStatus.classList.add("error");
  } else if (pipeline?.status === "succeeded") {
    commandStatus.classList.remove("error");
    commandStatus.textContent = "Sync, Jev classification, and output publication completed successfully.";
  } else if (outputs?.status === "succeeded" && outputs.result) {
    commandStatus.classList.remove("error");
    commandStatus.textContent = `Published ${Number(outputs.result.classified_email_count || 0).toLocaleString()} classified emails into ${Number(outputs.result.application_count || 0).toLocaleString()} applications. Email Board and Analytics now use this result set.`;
  }
  renderPipelineDetail(snapshot);
}

async function startFullCommandPipeline() {
  selectPipelineStep("ingestion");
  commandStatus.classList.remove("error");
  commandStatus.textContent = "Starting Sync → Jev → Publish pipeline…";
  runCommandPipeline.disabled = true;
  try {
    const response = await apiFetch("/api/command/pipeline", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not start the pipeline");
    if (latestCommandSnapshot) {
      latestCommandSnapshot.pipeline = result.pipeline;
      renderCommandPipeline(latestCommandSnapshot);
    }
    commandStatus.textContent = "The full pipeline is running. This view follows its active step automatically.";
  } catch (error) {
    commandStatus.textContent = error instanceof Error ? error.message : String(error);
    commandStatus.classList.add("error");
  } finally {
    await loadCommandRuns();
  }
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
    const response = await apiFetch("/api/command/publish", { method: "POST" });
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
    const response = await apiFetch("/api/command/ingest", { method: "POST" });
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
    const response = await apiFetch("/api/command/status", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load classification runs");
    renderCommandPipeline(result);
  } catch (error) {
    commandStatus.textContent = error instanceof Error ? error.message : String(error);
    commandStatus.classList.add("error");
  }
}

async function startCommandRun() {
  const payload = commandPayload();
  if (payload.scope === "all" && payload.replace_existing) {
    const confirmed = window.confirm(
      "Fresh replacement will permanently delete previous classification runs and clear manual/AI overrides before reclassifying the entire mailbox. Gmail emails, drafts, and stars are preserved. Continue?",
    );
    if (!confirmed) return;
  }
  selectPipelineStep("classification");
  commandStatus.textContent = payload.scope === "all" && payload.replace_existing
    ? "Clearing old classification records and creating the fresh full-mailbox run…"
    : payload.scope === "all"
      ? "Creating a full-mailbox reclassification run while preserving history…"
      : "Creating a new-email classification run…";
  commandStatus.classList.remove("error");
  try {
    const response = await apiFetch("/api/command/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    const response = await apiFetch("/api/labels", {
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
    const response = await apiFetch("/api/resample", {
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
      apiFetch("/sample.json", { cache: "no-store" }),
      apiFetch("/api/labels", { cache: "no-store" }),
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
    for (const tab of aiTabs) {
      tab.addEventListener("click", () => navigateToAi(tab.dataset.aiMode));
    }
    window.addEventListener("hashchange", applyRouteFromHash);
    window.addEventListener("resize", () => {
      if (!battlegroundView.hidden) renderBattlegroundDecisionMap(latestBattlegroundReport);
    });
    document.querySelector("#refreshBenchmark").addEventListener("click", () => void loadBenchmark());
    benchmarkFilter.addEventListener("change", renderBenchmarkRows);
    benchmarkScope.addEventListener("change", () => void loadBenchmark());
    document.querySelector("#refreshCommand").addEventListener("click", () => void loadCommandRuns());
    commandClassificationScope.addEventListener("change", () => {
      if (commandClassificationScope.value === "all") commandClassificationResultMode.value = "replace";
      syncCommandClassificationOptions();
    });
    commandClassificationResultMode.addEventListener("change", syncCommandClassificationOptions);
    runCommandPipeline.addEventListener("click", () => void startFullCommandPipeline());
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
    battlegroundDecisionPool.addEventListener("pointermove", handleDecisionPoolHover);
    battlegroundDecisionPool.addEventListener("pointerleave", () => { battlegroundPoolTooltip.hidden = true; });
    battlegroundCategoryHeatmap.addEventListener("pointermove", handleCategoryHeatmapHover);
    battlegroundCategoryHeatmap.addEventListener("pointerleave", () => { battlegroundHeatmapTooltip.hidden = true; });
    document.querySelector("#refreshBoard").addEventListener("click", () => void loadBoard());
    boardCategory.addEventListener("change", () => {
      boardCurrentEmailId = null;
      void loadBoard();
    });
    boardAction.addEventListener("change", () => {
      boardCurrentEmailId = null;
      void loadBoard();
    });
    document.querySelector("#refreshAnalytics").addEventListener("click", () => {
      invalidateApiCache();
      void loadAnalytics();
    });
    analyticsRange.addEventListener("change", () => void loadAnalytics());
    document.querySelector("#refreshApplications").addEventListener("click", () => void loadApplications());
    applicationStatus.addEventListener("change", () => {
      currentApplicationId = null;
      void loadApplications();
    });
    document.querySelector("#refreshAi").addEventListener("click", () => void loadAiReviews());
    aiLaneSelect.addEventListener("change", () => {
      currentAiEmailId = null;
      aiBatchProgress.style.width = "0%";
      aiReviewDetail.replaceChildren(element("p", "board-empty", "Select an email to inspect its structured review."));
      renderAiReviewQueue();
    });
    runAiLane.addEventListener("click", () => void runAiLaneReview());
    aiChatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void askAiChat();
    });
    newAiChat.addEventListener("click", () => void createNewAiChat().catch((error) => {
      aiChatStatus.textContent = error instanceof Error ? error.message : String(error);
    }));
    closeAiChat.addEventListener("click", () => {
      if (!aiChatConversationIdValue) return;
      void archiveAiChatConversation(aiChatConversationIdValue).catch((error) => {
        aiChatStatus.textContent = error instanceof Error ? error.message : String(error);
      });
    });
    deleteAiChat.addEventListener("click", () => {
      if (!aiChatConversationIdValue || !aiChatConversationArchived) return;
      void deleteAiChatConversation(aiChatConversationIdValue, aiChatConversationTitle.textContent).catch((error) => {
        aiChatStatus.textContent = error instanceof Error ? error.message : String(error);
      });
    });
    document.querySelectorAll("[data-chat-suggestion]").forEach((button) => {
      button.addEventListener("click", () => void askAiChat(button.dataset.chatSuggestion));
    });
    document.querySelector("#closeReplyDialog").addEventListener("click", () => replyDialog.close());
    document.querySelector("#generateReply").addEventListener("click", () => void generateStreamingReply());
    document.querySelector("#saveReply").addEventListener("click", () => void saveReplyDraft());
    document.querySelector("#copyReply").addEventListener("click", async () => {
      await navigator.clipboard.writeText([replySubject.value, "", replyBody.value].join("\n"));
      replyStreamStatus.textContent = "Subject and reply copied.";
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
