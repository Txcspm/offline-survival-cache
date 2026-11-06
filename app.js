"use strict";
// The app has no runtime network dependencies beyond its own static library files.
const $ = (id) => document.getElementById(id);
const NOTES_KEY = "osc_field_notes_v1";
const WORKSPACE_KEY = "osc_workspace_v2";
const CATEGORIES = DIVISIONS.flatMap(([, categories]) => categories);
const DEFAULT_WORKSPACE = () => ({
  version: 2,
  bookmarks: [],
  recent: [],
  annotations: {},
  theme: "light",
});
let workspace = DEFAULT_WORKSPACE();
let workspaceUnreadable = false;
let articles = LEGACY_ARTICLES.map((a) => ({
  ...a,
  status: "draft",
  content_stage: "draft",
  sources: [],
  source_review:
    "Original embedded reference. Pending independent source and editorial review.",
  legacy: true,
}));
let catalog;
let page = 0;
let currentArticle;
let noteSnapshot = "";
let annotationSnapshot = "";
let offlineReady = false;
let installPrompt;
let toastTimer;
function element(tag, text, className) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4500);
}
function wordCount(a) {
  return a.body.join(" ").trim().split(/\s+/).length;
}
function readingTime(a) {
  return Math.max(1, Math.ceil(wordCount(a) / 200));
}
function saveWorkspace(next = workspace) {
  if (workspaceUnreadable)
    throw Error(
      "Existing workspace data needs recovery before it can be changed.",
    );
  // Only update the in-memory view after the durable write succeeds.
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next));
  workspace = next;
}
function validId(id) {
  return typeof id === "string" && /^OSC-\d{4,6}$/.test(id);
}
function validateWorkspace(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.version !== 2
  )
    throw Error("Unsupported workspace version.");
  if (
    Object.keys(data).some(
      (k) =>
        !["version", "bookmarks", "recent", "annotations", "theme"].includes(k),
    )
  )
    throw Error("Unexpected backup fields.");
  for (const field of ["bookmarks", "recent"]) {
    if (
      !Array.isArray(data[field]) ||
      data[field].length > 10000 ||
      !data[field].every(validId)
    )
      throw Error("Invalid reading list.");
  }
  if (
    !data.annotations ||
    typeof data.annotations !== "object" ||
    Array.isArray(data.annotations) ||
    Object.keys(data.annotations).length > 10000
  )
    throw Error("Invalid annotations.");
  for (const [id, text] of Object.entries(data.annotations))
    if (!validId(id) || typeof text !== "string" || text.length > 100000)
      throw Error("Invalid annotation.");
  if (!["light", "dark"].includes(data.theme)) throw Error("Invalid theme.");
  return {
    version: 2,
    bookmarks: [...new Set(data.bookmarks)],
    recent: [...new Set(data.recent)].slice(0, 20),
    annotations: Object.fromEntries(Object.entries(data.annotations)),
    theme: data.theme,
  };
}
try {
  const saved = localStorage.getItem(WORKSPACE_KEY);
  if (saved) workspace = validateWorkspace(JSON.parse(saved));
} catch (error) {
  workspaceUnreadable = true;
  $("backupMessage").textContent =
    "Existing saved-reading data could not be read. It has been preserved; export its raw record for recovery before replacing it.";
  const recover = element("button", "Export unreadable workspace record");
  recover.onclick = () => {
    try {
      downloadJSON(
        {
          format: "osc-recovery",
          version: 1,
          workspace_raw: localStorage.getItem(WORKSPACE_KEY),
          notes: $("fieldNotes").value,
        },
        "survival-cache-recovery.json",
      );
    } catch (_) {
      toast("Storage cannot be read. Copy any visible notes.");
    }
  };
  $("backupMessage").after(recover);
}
try {
  $("fieldNotes").value = localStorage.getItem(NOTES_KEY) || "";
} catch (error) {
  $("noteMessage").textContent =
    "Notebook storage is unavailable. Export any visible notes before leaving.";
}
noteSnapshot = $("fieldNotes").value;
document.documentElement.dataset.theme = workspace.theme;
function updateTheme() {
  document.documentElement.dataset.theme = workspace.theme;
  $("themeToggle").textContent =
    workspace.theme === "light"
      ? "Switch to dark theme"
      : "Switch to light theme";
}
updateTheme();
$("themeToggle").onclick = () => {
  try {
    saveWorkspace({
      ...workspace,
      theme: workspace.theme === "light" ? "dark" : "light",
    });
    updateTheme();
  } catch (_) {
    toast("Theme could not be saved: storage is unavailable.");
  }
};
$("mobileThemeToggle").onclick = () => $("themeToggle").click();
function notebookDirty() {
  return $("fieldNotes").value !== noteSnapshot;
}
function annotationDirty() {
  return (
    currentArticle &&
    $("articleAnnotation") &&
    $("articleAnnotation").value !== annotationSnapshot
  );
}
window.addEventListener("beforeunload", (event) => {
  if (notebookDirty() || annotationDirty()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
function updateNoteCount() {
  const text = $("fieldNotes").value.trim();
  $("noteCount").textContent = (text ? text.split(/\s+/).length : 0) + " words";
}
$("fieldNotes").addEventListener("input", () => {
  updateNoteCount();
  $("noteMessage").textContent = "Unsaved changes";
});
updateNoteCount();
$("saveNotes").onclick = () => {
  try {
    localStorage.setItem(NOTES_KEY, $("fieldNotes").value);
    noteSnapshot = $("fieldNotes").value;
    $("noteMessage").textContent = "Saved on this device.";
    toast("Notebook saved.");
  } catch (_) {
    $("noteMessage").textContent = "Save failed. Export a copy before leaving.";
  }
};
function downloadJSON(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  if (blob.size > 20000000) {
    toast(
      "This export exceeds 20 MB. Save a smaller set of annotations or copy the text separately.",
    );
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = element("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
$("exportNotes").onclick = () =>
  downloadJSON(
    { format: "osc-notes", version: 1, notes: $("fieldNotes").value },
    "survival-cache-notes.json",
  );
$("importNotes").onclick = () => $("notesFile").click();
$("notesFile").onchange = async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 20000000) throw Error("File exceeds 20 MB.");
    const data = JSON.parse(await file.text());
    if (
      data.format !== "osc-notes" ||
      data.version !== 1 ||
      typeof data.notes !== "string" ||
      data.notes.length > 2000000
    )
      throw Error("Not a supported notes backup.");
    if (
      !confirm(
        "Replace the notebook editor with these notes? Save Notes will persist the replacement.",
      )
    )
      return;
    $("fieldNotes").value = data.notes;
    updateNoteCount();
    $("noteMessage").textContent =
      "Imported into the editor. Save Notes to keep this version.";
  } catch (error) {
    $("noteMessage").textContent = "Import failed: " + error.message;
  } finally {
    event.target.value = "";
  }
};
$("exportBackup").onclick = () => {
  if (annotationDirty()) {
    toast("Save your article annotation before exporting a full backup.");
    return;
  }
  if (workspaceUnreadable) {
    toast(
      "Export the unreadable workspace record for recovery before making a normal backup.",
    );
    return;
  }
  const exported = downloadJSON(
    {
      format: "osc-backup",
      version: 2,
      exported_at: new Date().toISOString(),
      notes: $("fieldNotes").value,
      workspace,
    },
    "survival-cache-backup.json",
  );
  if (exported)
    $("backupMessage").textContent =
      "Backup exported. Keep a copy on a separate device.";
};
$("importBackup").onclick = () => $("backupFile").click();
$("backupFile").onchange = async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 20000000) throw Error("Backup exceeds 20 MB.");
    const data = JSON.parse(await file.text());
    if (
      !data ||
      data.format !== "osc-backup" ||
      data.version !== 2 ||
      typeof data.notes !== "string" ||
      data.notes.length > 2000000
    )
      throw Error("Not a supported full backup.");
    if (
      Object.keys(data).some(
        (k) =>
          !["format", "version", "exported_at", "notes", "workspace"].includes(
            k,
          ),
      )
    )
      throw Error("Unexpected backup fields.");
    const next = validateWorkspace(data.workspace);
    if (
      !confirm(
        "Restore this backup? It replaces the notebook, saved reading, annotations and preferences on this device. Export your current data first if needed.",
      )
    )
      return;
    // Roll back the first key if the second write fails. Never clear storage.
    const old = localStorage.getItem(WORKSPACE_KEY);
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next));
    try {
      localStorage.setItem(NOTES_KEY, data.notes);
    } catch (error) {
      if (old === null) localStorage.removeItem(WORKSPACE_KEY);
      else localStorage.setItem(WORKSPACE_KEY, old);
      throw error;
    }
    workspace = next;
    workspaceUnreadable = false;
    $("fieldNotes").value = data.notes;
    noteSnapshot = data.notes;
    updateNoteCount();
    updateTheme();
    updateSaved();
    renderRecent();
    $("backupMessage").textContent =
      "Backup restored and saved on this device.";
    toast("Your field desk has been restored.");
  } catch (error) {
    $("backupMessage").textContent = "Restore failed: " + error.message;
  } finally {
    event.target.value = "";
  }
};
function toggleBookmark(id) {
  try {
    const bookmarks = workspace.bookmarks.includes(id)
      ? workspace.bookmarks.filter((x) => x !== id)
      : [...workspace.bookmarks, id];
    saveWorkspace({ ...workspace, bookmarks });
    updateSaved();
    document.querySelectorAll("[data-bookmark]").forEach((b) => {
      if (b.dataset.bookmark === id) setBookmarkLabel(b, id);
    });
  } catch (_) {
    toast(
      "Could not save reading list. Export a backup or free device storage.",
    );
  }
}
function setBookmarkLabel(button, id) {
  const saved = workspace.bookmarks.includes(id);
  button.textContent = saved ? "◆" : "◇";
  button.setAttribute("aria-pressed", String(saved));
  button.setAttribute(
    "aria-label",
    (saved ? "Unsave " : "Save ") +
      (articles.find((a) => a.id === id)?.title || id),
  );
}
function bookmarkButton(id) {
  const b = element("button", undefined, "bookmark");
  b.dataset.bookmark = id;
  setBookmarkLabel(b, id);
  b.onclick = () => toggleBookmark(id);
  return b;
}
function articleCard(a) {
  const box = element("article", undefined, "article-card");
  box.append(element("div", a.category, "card-kicker"), bookmarkButton(a.id));
  const heading = element("h3");
  const link = element("a", a.title);
  link.href = "#" + a.id;
  heading.append(link);
  box.append(heading, element("p", a.summary));
  const footer = element("div", undefined, "card-footer");
  footer.append(
    element(
      "span",
      a.status.replaceAll("_", " "),
      "badge " + (a.status === "approved" ? "" : "warning"),
    ),
    element("span", readingTime(a) + " min read"),
  );
  const read = element("a", "Read guide →");
  read.href = "#" + a.id;
  footer.append(read);
  box.append(footer);
  return box;
}
const categorySymbols = [
  "↟",
  "✚",
  "⌂",
  "≈",
  "◒",
  "✳",
  "♧",
  "△",
  "ϟ",
  "⌑",
  "⚙",
  "≋",
  "♨",
  "⌁",
  "▧",
  "∑",
  "▤",
  "⌖",
  "→",
  "◇",
  "☂",
  "◉",
  "⌂",
  "☼",
  "◎",
  "⇄",
  "❧",
  "¶",
  "▦",
  "✓",
];
const shortNames = {
  "Emergency Survival & Decision Making": "Emergency readiness",
  "Medical Care & First Aid": "Medical & first aid",
  "Shelter & Environmental Protection": "Shelter & protection",
  "Water Collection & Treatment": "Water & treatment",
  "Agriculture & Gardening": "Growing food",
  "Power Generation & Electricity": "Power & electricity",
  "Knowledge Preservation & Education": "Knowledge & education",
  "Radio & Emergency Communications": "Emergency communications",
  "Food & Nutrition": "Food & nutrition",
};
function categoryCard(category) {
  const i = CATEGORIES.indexOf(category);
  const list = articles.filter(
    (a) => a.category === category && a.status !== "retired",
  );
  const a = element("a", undefined, "category-card");
  a.href = "#library?category=" + encodeURIComponent(category);
  a.append(
    element("span", categorySymbols[i] || "◈", "category-symbol"),
    element("h3", shortNames[category] || category),
  );
  const meta = element("div", undefined, "category-meta");
  meta.append(
    element(
      "span",
      list.length
        ? list.length +
            " articles · " +
            list.filter((a) => a.status === "approved").length +
            " approved"
        : "Planned · no articles yet",
    ),
    element("span", "EXPLORE →"),
  );
  a.append(meta);
  return a;
}
function renderCategories() {
  $("featuredCategories").replaceChildren(
    ...[
      CATEGORIES[0],
      CATEGORIES[3],
      CATEGORIES[4],
      CATEGORIES[2],
      CATEGORIES[8],
      CATEGORIES[16],
    ].map(categoryCard),
  );
  $("allCategories").replaceChildren(
    ...DIVISIONS.map(([name, categories], index) => {
      const section = element("section", undefined, "category-division");
      section.append(
        element(
          "div",
          String(index + 1).padStart(2, "0") + " / DIVISION",
          "eyebrow",
        ),
        element("h2", name),
      );
      const grid = element("div", undefined, "category-grid");
      grid.append(...categories.map(categoryCard));
      section.append(grid);
      return section;
    }),
  );
  const selected = $("categoryFilter").value;
  $("categoryFilter").replaceChildren(
    new Option("All 30 categories", "all"),
    ...CATEGORIES.map((c) => new Option(c, c)),
  );
  $("categoryFilter").value = CATEGORIES.includes(selected) ? selected : "all";
}
function renderRecent() {
  const list = workspace.recent
    .map((id) => articles.find((a) => a.id === id))
    .filter(Boolean)
    .slice(0, 3);
  $("recentSection").hidden = !list.length;
  $("recentArticles").replaceChildren(...list.map(articleCard));
}
function empty(title, text) {
  const box = element("div", undefined, "empty");
  box.append(element("h2", title), element("p", text));
  return box;
}
function updateSaved() {
  $("savedCount").textContent = workspace.bookmarks.length;
  const list = workspace.bookmarks
    .map((id) => articles.find((a) => a.id === id))
    .filter(Boolean);
  $("savedArticles").replaceChildren(
    ...(list.length
      ? list.map(articleCard)
      : [
          empty(
            "Your shelf is ready.",
            "Tap the diamond on any article to keep it here.",
          ),
        ]),
  );
  const missing = workspace.bookmarks.filter(
    (id) => !articles.some((a) => a.id === id),
  );
  if (missing.length)
    $("savedArticles").append(
      empty(
        "Some saved articles are unavailable",
        missing.join(", ") +
          ". Their IDs and annotations are preserved in your backup.",
      ),
    );
}
function renderLibrary() {
  const q = $("search").value.trim().toLocaleLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const category = $("categoryFilter").value;
  const status = $("statusFilter").value;
  const stage = $("stageFilter").value;
  const score = (a) =>
    terms.reduce(
      (n, t) =>
        n +
        (a.id.toLowerCase() === t ? 100 : 0) +
        (a.title.toLowerCase().includes(t) ? 10 : 0) +
        (a.summary.toLowerCase().includes(t) ? 3 : 0),
      0,
    );
  let list = articles.filter(
    (a) =>
      (category === "all" || a.category === category) &&
      (status === "all" || a.status === status) &&
      (stage === "all" || a.content_stage === stage) &&
      terms.every((t) => a.searchText.includes(t)),
  );
  const sort = $("sortFilter").value;
  list.sort(
    (a, b) =>
      (sort === "priority"
        ? a.priority.localeCompare(b.priority)
        : sort === "length"
          ? wordCount(b) - wordCount(a)
          : sort === "relevance"
            ? score(b) - score(a)
            : 0) || a.title.localeCompare(b.title),
  );
  const pages = Math.max(1, Math.ceil(list.length / 24));
  page = Math.min(page, pages - 1);
  const top = element("div", undefined, "results-heading");
  top.append(
    element(
      "span",
      list.length + " matching article" + (list.length === 1 ? "" : "s"),
    ),
    element("span", "Search runs entirely on this device"),
  );
  const grid = element("div", undefined, "result-grid");
  grid.append(
    ...(list.length
      ? list.slice(page * 24, (page + 1) * 24).map(articleCard)
      : [
          empty(
            "No references found.",
            "Try fewer words or another category. Some parts of the planned library have not been written yet.",
          ),
        ]),
  );
  const pager = element("div", undefined, "pagination");
  const prev = element("button", "← Previous");
  const next = element("button", "Next →");
  prev.disabled = page === 0;
  next.disabled = page >= pages - 1;
  prev.onclick = () => {
    page--;
    renderLibrary();
  };
  next.onclick = () => {
    page++;
    renderLibrary();
  };
  pager.append(
    prev,
    element("span", "Page " + (page + 1) + " of " + pages),
    next,
  );
  $("results").replaceChildren(top, grid, pager);
}
$("searchForm").onsubmit = (e) => {
  e.preventDefault();
  page = 0;
  renderLibrary();
};
$("search").oninput = () => {
  page = 0;
  renderLibrary();
};
for (const id of [
  "categoryFilter",
  "statusFilter",
  "stageFilter",
  "sortFilter",
])
  $(id).onchange = () => {
    page = 0;
    renderLibrary();
  };
$("clearSearch").onclick = () => {
  $("search").value = "";
  $("categoryFilter").value = "all";
  $("statusFilter").value = "all";
  $("stageFilter").value = "all";
  page = 0;
  renderLibrary();
};
$("quickSearch").onclick = () => {
  location.hash = "library";
  setTimeout(() => $("search").focus(), 0);
};
window.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
  ) {
    event.preventDefault();
    $("quickSearch").click();
  }
});
function renderReader(a) {
  const pending =
    currentArticle?.id === a.id ? $("articleAnnotation")?.value : undefined;
  currentArticle = a;
  annotationSnapshot = workspace.annotations[a.id] || "";
  const back = element("a", "← Back to the library", "reader-back");
  back.href = "#library";
  const article = element("article");
  article.id = a.id;
  const heading = element("header", undefined, "reader-heading");
  heading.append(
    element("div", a.category.toUpperCase(), "eyebrow"),
    element("h1", a.title),
    element("p", a.summary, "summary"),
  );
  const meta = element("div", undefined, "reader-meta");
  meta.append(
    element("span", a.id),
    element("span", a.priority + " priority"),
    element("span", readingTime(a) + " min read"),
    element("span", a.status.replaceAll("_", " "), "badge warning"),
    element("span", a.content_stage + " text", "badge"),
  );
  heading.append(meta);
  const tools = element("div", undefined, "toolbar");
  const save = element(
    "button",
    workspace.bookmarks.includes(a.id) ? "Remove from saved" : "Save for later",
  );
  save.onclick = () => {
    toggleBookmark(a.id);
    save.textContent = workspace.bookmarks.includes(a.id)
      ? "Remove from saved"
      : "Save for later";
  };
  const print = element("button", "Print this guide");
  print.onclick = () => printArticle(article, a);
  const share = element("button", "Copy article link");
  share.onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("Article link copied.");
    } catch (_) {
      toast("Copy the address from your browser to share this article.");
    }
  };
  tools.append(save, print, share);
  heading.append(tools);
  const notice = element("div", undefined, "notice");
  notice.append(
    element("span", "!", "notice-icon"),
    element(
      "div",
      a.status === "approved"
        ? "Approved in the editorial record. Check the review date, scope and local guidance."
        : "Unverified reference material. This draft has not passed independent editorial or safety review. Do not use it as the sole basis for safety-critical decisions.",
    ),
  );
  const layout = element("div", undefined, "reader-layout");
  const body = element("div", undefined, "reader-body");
  const procedure = element("div");
  procedure.id = "procedure";
  a.body.forEach((text, index) => {
    const section = element("section", undefined, "body-section");
    section.append(
      element(
        "span",
        String(index + 1).padStart(2, "0") + " / FIELD GUIDE",
        "step-number",
      ),
    );
    const match = text.match(/^([^:]{3,65}):\s+([\s\S]*)$/);
    if (match) section.append(element("h2", match[1]), element("p", match[2]));
    else section.append(element("p", text));
    procedure.append(section);
  });
  body.append(procedure);
  const sourcePanel = element("section", undefined, "reader-panel");
  sourcePanel.id = "sources";
  sourcePanel.append(
    element("h2", "Sources & editorial record"),
    element("p", a.source_review || "No completed source review is recorded."),
  );
  sourcePanel.append(
    element(
      "p",
      "Reviewed by: " +
        (a.reviewed_by || "Not independently reviewed") +
        " · Review date: " +
        (a.reviewed_on || "None recorded"),
    ),
  );
  const sourceList = element("ol", undefined, "source-list");
  for (const source of a.sources || []) {
    const li = element("li");
    const link = element("a", (source.title || source.organization) + " →");
    if (/^https:\/\//.test(source.url)) {
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    li.append(
      link,
      element(
        "small",
        [
          source.organization,
          source.locator,
          source.accessed_on
            ? "Reference accessed " + source.accessed_on
            : "Access date not recorded",
        ]
          .filter(Boolean)
          .join(" · "),
      ),
    );
    sourceList.append(li);
  }
  if (!sourceList.children.length)
    sourceList.append(
      element("li", "No article-specific source records are available."),
    );
  sourcePanel.append(
    sourceList,
    element(
      "p",
      "The article text is stored offline. External reference websites require a connection.",
    ),
  );
  body.append(sourcePanel);
  const annotation = element("section", undefined, "reader-panel annotation");
  annotation.id = "annotation";
  annotation.append(
    element("h2", "Your field annotation"),
    element(
      "p",
      "Keep observations with this article. Private to this browser and included in full backups.",
    ),
  );
  const label = element("label", "Article annotation", "sr-only");
  label.htmlFor = "articleAnnotation";
  const textarea = element("textarea");
  textarea.id = "articleAnnotation";
  textarea.value = pending ?? annotationSnapshot;
  textarea.maxLength = 100000;
  textarea.placeholder = "What worked? What needs a local check?";
  const controls = element("div", undefined, "annotation-actions");
  const message = element(
    "span",
    annotationSnapshot ? "Saved on this device." : "No annotation yet.",
  );
  const button = element("button", "Save annotation", "primary");
  textarea.oninput = () => (message.textContent = "Unsaved annotation");
  button.onclick = () => {
    try {
      saveWorkspace({
        ...workspace,
        annotations: { ...workspace.annotations, [a.id]: textarea.value },
      });
      annotationSnapshot = textarea.value;
      message.textContent = "Annotation saved.";
      toast("Article annotation saved.");
    } catch (_) {
      message.textContent = "Save failed. Copy this text before leaving.";
    }
  };
  controls.append(message, button);
  annotation.append(label, textarea, controls);
  body.append(annotation);
  const toc = element("nav", undefined, "reader-toc");
  toc.setAttribute("aria-label", "On this page");
  toc.append(element("strong", "ON THIS PAGE"));
  for (const [id, labelText] of [
    ["procedure", "Field guide"],
    ["sources", "Sources & review"],
    ["annotation", "Your annotation"],
  ]) {
    const b = element("a", labelText);
    b.href = "#" + a.id;
    b.onclick = (event) => {
      event.preventDefault();
      $(id).scrollIntoView({ behavior: "smooth" });
      $(id).setAttribute("tabindex", "-1");
      $(id).focus({ preventScroll: true });
    };
    toc.append(b);
  }
  layout.append(body, toc);
  article.append(heading, notice, layout);
  const related = element("div");
  related.append(element("div", "KEEP EXPLORING", "eyebrow"));
  const relatedGrid = element("div", undefined, "article-grid");
  relatedGrid.append(
    ...articles
      .filter((x) => x.id !== a.id && x.category === a.category)
      .slice(0, 3)
      .map(articleCard),
  );
  related.append(relatedGrid);
  related.className = "reader-panel";
  $("reader").replaceChildren(back, article, related);
  try {
    saveWorkspace({
      ...workspace,
      recent: [a.id, ...workspace.recent.filter((id) => id !== a.id)].slice(
        0,
        20,
      ),
    });
    renderRecent();
  } catch (_) {}
}
function printArticle(article, a) {
  const popup = window.open("", "_blank");
  if (!popup) {
    toast("Allow a popup to print this individual guide.");
    return;
  }
  popup.document.title = a.title;
  const style = popup.document.createElement("style");
  style.textContent =
    "body{font:12pt/1.7 Georgia,serif;color:#111;max-width:760px;margin:30px auto;padding:20px}h1{font-size:28pt}h2{font-size:16pt}.toolbar,.annotation,.reader-toc{display:none}.notice{border:1px solid #777;padding:12px}.reader-meta{font-size:10pt}.body-section{margin:22px 0}.step-number{font-size:9pt}a{overflow-wrap:anywhere}";
  popup.document.head.append(style);
  const clone = article.cloneNode(true);
  clone
    .querySelectorAll(".toolbar,.annotation,.reader-toc")
    .forEach((e) => e.remove());
  popup.document.body.append(clone);
  popup.focus();
  popup.print();
}
let lastRoute = location.hash;
function route() {
  if (
    annotationDirty() &&
    lastRoute !== location.hash &&
    !confirm("Leave this article and discard the unsaved annotation?")
  ) {
    history.replaceState(null, "", lastRoute);
    return;
  }
  const [rawName, query = ""] = location.hash.slice(1).split("?");
  let name;
  try {
    name = decodeURIComponent(rawName);
  } catch (_) {
    name = "dashboard";
  }
  const a = articles.find((a) => a.id === name);
  const validPages = [
    "dashboard",
    "library",
    "categories",
    "saved",
    "notes",
    "archive",
  ];
  let target = a ? "reader" : validPages.includes(name) ? name : "dashboard";
  if (validId(name) && !a) {
    target = "reader";
    $("reader").replaceChildren(
      empty(
        "Article not available.",
        "This ID is not in the current local collection. Refresh the library when connected, or browse the available references.",
      ),
    );
  }
  if (target !== "reader") currentArticle = null;
  if (a) renderReader(a);
  if (target === "library") {
    const params = new URLSearchParams(query);
    if (params.has("category"))
      $("categoryFilter").value = CATEGORIES.includes(params.get("category"))
        ? params.get("category")
        : "all";
    if (params.has("q")) $("search").value = params.get("q");
    page = 0;
    renderLibrary();
  }
  document
    .querySelectorAll(".page")
    .forEach((p) => (p.hidden = p.id !== target));
  document.querySelectorAll("#navigation a").forEach((link) => {
    const active =
      link.dataset.page === target ||
      (target === "reader" && link.dataset.page === "library");
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const label = a
    ? a.id
    : target === "reader"
      ? "ARTICLE"
      : target.toUpperCase();
  $("breadcrumb").replaceChildren(
    document.createTextNode("FIELD LIBRARY "),
    element("span", "/ " + label),
  );
  document.title = a
    ? a.title + " — Survival Cache"
    : "Survival Cache — " + label.charAt(0) + label.slice(1).toLowerCase();
  lastRoute = location.hash;
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
function updateOverview() {
  for (const a of articles)
    a.searchText = [
      a.id,
      a.title,
      a.summary,
      a.category,
      a.priority,
      ...a.body,
      ...(a.sources || []).map((s) => s.organization + " " + (s.title || "")),
    ]
      .join(" ")
      .toLocaleLowerCase();
  $("articleCount").textContent = articles.length;
  $("navCount").textContent = articles.length;
  $("approvedCount").textContent = articles.filter(
    (a) => a.status === "approved",
  ).length;
  renderCategories();
  updateSaved();
  renderRecent();
  const featured = [...articles]
    .sort((a, b) => wordCount(b) - wordCount(a))
    .slice(0, 3);
  $("featuredArticles").replaceChildren(...featured.map(articleCard));
  const stats = element("div", undefined, "stats-line");
  for (const [count, label] of [
    [articles.length, "available references"],
    [articles.filter((a) => a.status === "draft").length, "drafts"],
    [articles.filter((a) => a.status === "approved").length, "approved"],
    [
      CATEGORIES.filter((c) => articles.some((a) => a.category === c)).length,
      "categories with content",
    ],
  ]) {
    const e = element("div");
    e.append(element("strong", String(count)), element("span", label));
    stats.append(e);
  }
  $("collectionStatus").replaceChildren(
    stats,
    element(
      "p",
      "The target is 3,650 detailed articles across 30 categories. Available articles include " +
        LEGACY_ARTICLES.length +
        " preserved original references. Content stage and editorial approval are separate: drafted text has not been independently verified.",
    ),
    element(
      "p",
      "Existing duplicate-title pairs flagged for editorial reconciliation: " +
        (catalog?.editorial?.duplicate_title_pairs
          ?.map((p) => p.join(" / "))
          .join("; ") || "See catalog after loading."),
    ),
  );
}
async function loadLibrary() {
  $("loadError").hidden = true;
  try {
    const response = await fetch("./knowledge/catalog.json");
    if (!response.ok) throw Error("Catalog HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data.articles) || !data.modules)
      throw Error("Invalid catalog.");
    const loaded = [];
    const seen = new Set(LEGACY_ARTICLES.map((a) => a.id));
    for (const [path, digest] of Object.entries(data.modules)) {
      if (
        !/^(survival_cache_starter_25\.json|knowledge\/modules\/[a-zA-Z0-9_-]+\.json)$/.test(
          path,
        )
      )
        throw Error("Invalid module path.");
      const r = await fetch("./" + path);
      if (!r.ok) throw Error("Module HTTP " + r.status);
      const bytes = await r.clone().arrayBuffer();
      const actual = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
      if (actual !== digest) throw Error("Module checksum mismatch.");
      const module = await r.json();
      if (!Array.isArray(module.articles)) throw Error("Invalid module.");
      for (const item of module.articles) {
        if (
          !validId(item.id) ||
          seen.has(item.id) ||
          !Array.isArray(item.body) ||
          !item.body.every((s) => typeof s === "string")
        )
          throw Error("Invalid or duplicate article.");
        seen.add(item.id);
        loaded.push({
          ...item,
          status: item.status || "draft",
          content_stage: item.content_stage || "draft",
        });
      }
    }
    if (
      loaded.length !== data.total ||
      data.articles.some((meta) => !loaded.some((a) => a.id === meta.id))
    )
      throw Error("Incomplete library.");
    articles = [
      ...LEGACY_ARTICLES.map((a) => ({
        ...a,
        status: "draft",
        content_stage: "draft",
        sources: [],
        legacy: true,
        source_review:
          "Original embedded reference. Pending independent source and editorial review.",
      })),
      ...loaded,
    ];
    catalog = data;
  } catch (error) {
    $("loadError").textContent =
      "The full library could not be loaded: " +
      error.message +
      " Only the references shown are available. Connect and refresh to retry.";
    $("loadError").hidden = false;
  }
  updateOverview();
  route();
}
function connection() {
  $("connection").textContent = navigator.onLine
    ? "Network available"
    : "Network unavailable";
}
window.addEventListener("online", connection);
window.addEventListener("offline", connection);
connection();
async function readyWorker() {
  let timer;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Error(
                "Offline installation did not finish. Connect and reload to retry.",
              ),
            ),
          30000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function workerRequest(type) {
  const registration = await readyWorker();
  if (!registration.active) throw Error("Offline worker is not active.");
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(
        Error(
          "The offline operation timed out. The previous library is retained.",
        ),
      );
    }, 120000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data);
    };
    registration.active.postMessage({ type }, [channel.port2]);
  });
}
async function checkOffline() {
  try {
    const result = await workerRequest("CHECK_OFFLINE_READY");
    offlineReady = result.ready === true;
    $("offlineBadge").textContent = offlineReady
      ? "● Available offline"
      : "◌ Offline copy incomplete";
    $("cacheHeading").textContent = offlineReady
      ? "Your library is on this device."
      : "Offline copy is incomplete.";
    $("offlineState").textContent = offlineReady
      ? "Offline library synchronized. Articles remain available after closing and reopening this browser."
      : "Connect and refresh the offline library to finish installation.";
    $("downloadProgress").value = offlineReady ? 100 : 0;
    $("cacheDetail").textContent =
      (result.version || "") +
      (result.count ? " · " + result.count + " cataloged articles" : "");
  } catch (error) {
    $("offlineState").textContent = error.message;
  }
}
async function refreshLibrary() {
  const b = $("refreshLibrary");
  b.disabled = true;
  b.textContent = "Downloading library…";
  $("updateNotice").textContent =
    "Keep this tab open. The previous library stays available until all files pass verification.";
  try {
    const result = await workerRequest("UPDATE_LIBRARY");
    if (!result.ok) throw Error(result.error);
    await checkOffline();
    $("updateNotice").textContent =
      "Download verified. Reload when you are ready to read updated content; your saved notes will be retained.";
    const reload = element("button", "Load updated articles");
    reload.onclick = () => {
      if (
        (notebookDirty() || annotationDirty()) &&
        !confirm(
          "Reload and discard unsaved edits? Save your notes first to keep them.",
        )
      )
        return;
      loadLibrary();
    };
    $("updateNotice").append(document.createTextNode(" "), reload);
  } catch (error) {
    $("updateNotice").textContent =
      "Refresh failed: " +
      error.message +
      " Your previous offline library is retained.";
    await checkOffline();
  } finally {
    b.disabled = false;
    b.textContent = "Refresh offline library";
    storageInfo();
  }
}
$("refreshLibrary").onclick = refreshLibrary;
async function storageInfo() {
  try {
    const usage = await navigator.storage?.estimate?.();
    const persistent = await navigator.storage?.persisted?.();
    $("storageState").textContent = usage
      ? ((usage.usage || 0) / 1048576).toFixed(1) +
        " MB used on this origin. " +
        (persistent
          ? "Persistent storage is granted."
          : "Storage is temporary unless this browser grants persistence.")
      : "This browser does not report storage usage.";
  } catch (_) {
    $("storageState").textContent = "Storage information is unavailable.";
  }
}
$("persistStorage").onclick = async () => {
  try {
    const granted = await navigator.storage?.persist?.();
    toast(
      granted
        ? "Persistent storage granted. Keep exported backups too."
        : "The browser did not grant persistence. Export a backup regularly.",
    );
    storageInfo();
  } catch (_) {
    toast("Persistent storage is unavailable in this browser.");
  }
};
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("installApp").hidden = false;
});
$("installApp").onclick = async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
    $("installApp").hidden = true;
  }
};
async function initializeOffline() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    $("offlineState").textContent =
      "Offline installation requires HTTPS or localhost and a browser with service workers.";
    $("offlineBadge").textContent = "Offline installation unavailable";
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", {
      scope: "./",
    });
    await readyWorker();
    await checkOffline();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          toast(
            "An application update is available. Save notes before reloading.",
          );
      });
    });
  } catch (error) {
    $("offlineState").textContent =
      "Installation failed: " +
      error.message +
      ". Connect and refresh this page to retry.";
    $("offlineBadge").textContent = "Offline copy incomplete";
  }
}
if ("serviceWorker" in navigator)
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "LIBRARY_PROGRESS") {
      $("downloadProgress").value = event.data.percent;
      $("cacheDetail").textContent =
        event.data.completed + " of " + event.data.total + " modules verified";
    }
  });
updateOverview();
route();
loadLibrary();
initializeOffline();
storageInfo();

async function checkArchiveDownload() {
  try {
    const response = await fetch("./downloads/offline-survival-cache.zip", {
      method: "HEAD",
      cache: "no-store",
    });
    if (response.status === 404) {
      $("downloadArchive").hidden = true;
      $("archiveHint").textContent =
        "This server does not host a ZIP. If you are using an extracted portable copy, keep the original archive for redistribution. Offline reading is unaffected.";
    }
  } catch (_) {
    /* The archive requires a connection; reading remains available offline. */
  }
}
checkArchiveDownload();
