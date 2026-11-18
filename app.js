
const STORAGE_KEY = "clipnest_items";
const LAST_WORK_KEY = "clipnest_last_work";

let clips = [];
let pendingImport = null;
let undoDelete = null;

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  clips = Array.isArray(saved) ? saved : [];
} catch {
  clips = [];
}

const $ = id => document.getElementById(id);

const form = $("clipForm");
const titleInput = $("clipTitle");
const categoryInput = $("clipCategory");
const folderInput = $("clipFolder");
const contentInput = $("clipContent");
const searchInput = $("searchInput");
const categoryFilter = $("categoryFilter");
const folderFilter = $("folderFilter");
const clipList = $("clipList");
const statusMessage = $("statusMessage");
const backupFile = $("backupFile");

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString() + Math.random().toString(16).slice(2);
}

function showStatus(message, type = "info", undoAction = null) {
  statusMessage.replaceChildren();

  const text = document.createElement("span");
  text.textContent = message;
  statusMessage.appendChild(text);
  statusMessage.className = "status-message " + type;

  if (undoAction) {
    statusMessage.appendChild(
      makeButton("Undo", undoAction, "secondary")
    );
  }
}

function saveClips() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clips));
    return true;
  } catch {
    showStatus("Unable to save. Your browser storage may be full.", "error");
    return false;
  }
}

function makeButton(label, action, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", action);
  return button;
}

function rememberLastWork(clip) {
  try {
    localStorage.setItem(LAST_WORK_KEY, JSON.stringify({
      id: clip.id,
      title: clip.title,
      action: "Last opened or edited",
      date: new Date().toISOString()
    }));
  } catch {}

  renderLastWork();
}

function renderLastWork() {
  const lastWorkText = $("lastWorkText");
  if (!lastWorkText) return;

  try {
    const last = JSON.parse(
      localStorage.getItem(LAST_WORK_KEY) || "null"
    );

    if (!last || !clips.some(clip => clip.id === last.id)) {
      localStorage.removeItem(LAST_WORK_KEY);
      lastWorkText.textContent =
        "Your last opened or edited clip will appear here.";
      return;
    }

    lastWorkText.textContent =
      last.action + ": " + last.title + " — " +
      new Date(last.date).toLocaleString();
  } catch {
    localStorage.removeItem(LAST_WORK_KEY);
    lastWorkText.textContent =
      "Your last opened or edited clip will appear here.";
  }
}

function addClip(event) {
  event.preventDefault();

  const content = contentInput.value.trim();

  if (!titleInput.value.trim()) {
    showStatus("Please enter a title.", "error");
    titleInput.focus();
    return;
  }

  if (!content) {
    showStatus("Please enter something to save.", "error");
    return;
  }

  const clip = {
    id: makeId(),
    title: titleInput.value.trim(),
    category: categoryInput.value || "Text",
    folder: folderInput.value.trim() || "My Clips",
    content,
    created: new Date().toISOString(),
    reminderDate: "",
    waiting: false,
    checklist: null
  };

  clips.unshift(clip);

  if (saveClips()) {
    form.reset();
    refreshFilters();
    renderAll();
    rememberLastWork(clip);
    showStatus("Clip saved!", "success");
  } else {
    clips = clips.filter(item => item.id !== clip.id);
  }
}

function quickCapture() {
  const input = $("quickCaptureContent");
  const content = input.value.trim();

  if (!content) {
    showStatus("Type or paste something first.", "error");
    input.focus();
    return;
  }

  const clip = {
    id: makeId(),
    title: "Quick Note",
    category: "Text",
    folder: "Inbox",
    content,
    created: new Date().toISOString(),
    reminderDate: "",
    waiting: false,
    checklist: null
  };

  clips.unshift(clip);

  if (saveClips()) {
    input.value = "";
    refreshFilters();
    renderAll();
    rememberLastWork(clip);
    showStatus("Quick Capture saved to Inbox!", "success");
  } else {
    clips = clips.filter(item => item.id !== clip.id);
  }
}

function refreshFilters() {
  const selectedCategory = categoryFilter.value;
  const selectedFolder = folderFilter.value;

  const categories = [...new Set(
    clips.map(c => c.category || "Other")
  )].sort();

  const folders = [...new Set(
    clips.map(c => c.folder || "My Clips")
  )].sort();

  categoryFilter.replaceChildren(new Option("All Categories", ""));

  categories.forEach(value =>
    categoryFilter.add(new Option(value, value))
  );

  folderFilter.replaceChildren(new Option("All Folders", ""));

  folders.forEach(value =>
    folderFilter.add(new Option(value, value))
  );

  categoryFilter.value = categories.includes(selectedCategory)
    ? selectedCategory : "";

  folderFilter.value = folders.includes(selectedFolder)
    ? selectedFolder : "";
}

function renderAll() {
  renderClips();
  renderReminders();
  renderWaiting();
  renderLastWork();
}

function renderClips() {
  const searchWords = searchInput.value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const category = categoryFilter.value;
  const folder = folderFilter.value;

  const filtered = clips.filter(clip => {
    const checklistText = Array.isArray(clip.checklist)
      ? clip.checklist.map(item => item.text).join(" ")
      : "";

    const searchableText = [
      clip.title,
      clip.category,
      clip.folder,
      clip.content,
      checklistText
    ].join(" ").toLowerCase();

    const matchesSearch = searchWords.every(word =>
      searchableText.includes(word)
    );

    return matchesSearch &&
      (!category || (clip.category || "Other") === category) &&
      (!folder || (clip.folder || "My Clips") === folder);
  });

  clipList.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = clips.length
      ? "No clips match your search or filters."
      : "No clips found. Add your first clip!";
    clipList.appendChild(empty);
    return;
  }

  filtered.forEach(clip => {
    const card = document.createElement("article");
    card.className = "clip clip-card";
    card.dataset.clipId = clip.id;

    const heading = document.createElement("h3");
    heading.textContent = clip.title;
    heading.tabIndex = 0;
    heading.addEventListener("click", () => rememberLastWork(clip));

    const details = document.createElement("small");
    details.textContent =
      (clip.category || "Other") + " • " +
      (clip.folder || "My Clips");

    card.append(heading, details);

    if (clip.waiting) {
      const tag = document.createElement("p");
      tag.textContent = "⏳ Waiting on someone";
      card.appendChild(tag);
    }

    if (clip.reminderDate) {
      const tag = document.createElement("p");
      tag.textContent = "📅 Reminder: " + formatDate(clip.reminderDate);
      card.appendChild(tag);
    }

    if (Array.isArray(clip.checklist)) {
      renderChecklist(card, clip);
    } else {
      const content = document.createElement("p");
      content.className = "clip-content";
      content.textContent = clip.content;

      // Preserve paragraph and line breaks in saved text.
      content.style.whiteSpace = "pre-wrap";

      content.addEventListener("click", () => rememberLastWork(clip));
      card.appendChild(content);
    }

    const actions = document.createElement("div");
    actions.className = "clip-actions";

    actions.append(
      makeButton("Copy", () => copyClip(clip)),
      makeButton("Edit", () => editClip(clip.id)),
      makeButton(
        clip.waiting ? "Stop Waiting" : "Waiting On",
        () => toggleWaiting(clip.id)
      ),
      makeButton(
        Array.isArray(clip.checklist)
          ? "Turn off Checklist"
          : "Make Checklist",
        () => toggleChecklist(clip.id)
      ),
      makeButton("Delete", () => deleteClip(clip.id), "danger")
    );

    card.appendChild(actions);

    const reminderControls = document.createElement("div");
    reminderControls.className = "reminder-controls";

    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = clip.reminderDate || "";
    dateInput.setAttribute("aria-label", "Reminder date");

    reminderControls.append(
      dateInput,
      makeButton("Save Reminder", () => {
        const previous = clip.reminderDate || "";
        clip.reminderDate = dateInput.value;

        if (saveClips()) {
          renderAll();
          showStatus(
            clip.reminderDate ? "Reminder saved." : "Reminder removed.",
            "success"
          );
        } else {
          clip.reminderDate = previous;
        }
      })
    );

    card.appendChild(reminderControls);
    clipList.appendChild(card);
  });
}

function renderChecklist(card, clip) {
  const heading = document.createElement("h4");
  heading.textContent = "Checklist";
  card.appendChild(heading);

  const list = document.createElement("div");
  list.className = "checklist-items";

  clip.checklist.forEach((item, index) => {
    const label = document.createElement("label");
    label.className = "checklist-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.done);

    checkbox.addEventListener("change", () => {
      const previous = item.done;
      item.done = checkbox.checked;

      if (saveClips()) {
        rememberLastWork(clip);
        renderAll();
      } else {
        item.done = previous;
        checkbox.checked = previous;
      }
    });

    const text = document.createElement("span");
    text.textContent = item.text;
    text.style.whiteSpace = "pre-wrap";

    if (item.done) {
      text.style.textDecoration = "line-through";
    }

    label.append(checkbox, text);
    list.appendChild(label);
  });

  card.appendChild(list);

  // Add a new checklist item without using pop-up prompts.
  const addForm = document.createElement("form");
  addForm.className = "checklist-add-form";

  const itemInput = document.createElement("input");
  itemInput.type = "text";
  itemInput.placeholder = "Add a checklist item";
  itemInput.setAttribute("aria-label", "New checklist item");
  itemInput.required = true;

  const addButton = document.createElement("button");
  addButton.type = "submit";
  addButton.textContent = "Add Item";

  addForm.append(itemInput, addButton);

  addForm.addEventListener("submit", event => {
    event.preventDefault();

    const text = itemInput.value.trim();
    if (!text) return;

    const newItem = { text, done: false };
    clip.checklist.push(newItem);

    if (saveClips()) {
      rememberLastWork(clip);
      renderAll();
      showStatus("Checklist item added.", "success");
    } else {
      clip.checklist.pop();
    }
  });

  card.appendChild(addForm);
}

function renderReminders() {
  const list = $("reminderList");
  if (!list) return;

  list.replaceChildren();

  const upcoming = clips
    .filter(clip => clip.reminderDate)
    .sort((a, b) =>
      a.reminderDate.localeCompare(b.reminderDate)
    );

  if (!upcoming.length) {
    list.textContent = "No reminders yet.";
    return;
  }

  upcoming.forEach(clip => {
    const item = document.createElement("p");
    item.textContent =
      formatDate(clip.reminderDate) + " — " + clip.title;
    item.tabIndex = 0;
    item.addEventListener("click", () => rememberLastWork(clip));
    list.appendChild(item);
  });
}

function renderWaiting() {
  const list = $("waitingList");
  if (!list) return;

  list.replaceChildren();

  const waiting = clips.filter(clip => clip.waiting);

  if (!waiting.length) {
    list.textContent = "Nothing waiting right now.";
    return;
  }

  waiting.forEach(clip => {
    const item = document.createElement("p");
    item.textContent = clip.title;
    item.tabIndex = 0;
    item.addEventListener("click", () => rememberLastWork(clip));
    list.appendChild(item);
  });
}

function formatDate(value) {
  if (!value) return "";

  const parts = value.split("-");
  if (parts.length !== 3) return value;

  return parts[1] + "/" + parts[2] + "/" + parts[0];
}

async function copyClip(clip) {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard unavailable");
    }

    await navigator.clipboard.writeText(clip.content);
    rememberLastWork(clip);
    showStatus("Copied!", "success");
  } catch {
    showStatus(
      "Clipboard access isn't available. You can copy the text manually.",
      "error"
    );
  }
}

function editClip(id) {
  const clip = clips.find(item => item.id === id);
  if (!clip) return;

  rememberLastWork(clip);

  const card = clipList.querySelector(
    '[data-clip-id="' + CSS.escape(id) + '"]'
  );

  if (!card) return;

  const editor = document.createElement("form");
  editor.className = "edit-form";

  const title = document.createElement("input");
  title.value = clip.title;
  title.required = true;
  title.setAttribute("aria-label", "Clip title");

  const category = document.createElement("select");
  ["Text", "Images", "Links", "Ideas", "Other"].forEach(value =>
    category.add(new Option(value, value))
  );
  category.value = clip.category || "Other";
  category.setAttribute("aria-label", "Category");

  const folder = document.createElement("input");
  folder.value = clip.folder || "My Clips";
  folder.placeholder = "Folder";
  folder.setAttribute("aria-label", "Folder");

  const content = document.createElement("textarea");
  content.value = clip.content || "";
  content.setAttribute("aria-label", "Clip content");

  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save Changes";

  editor.append(
    title,
    category,
    folder,
    content,
    save,
    makeButton("Cancel", renderAll, "secondary")
  );

  card.replaceChildren(editor);

  editor.addEventListener("submit", event => {
    event.preventDefault();

    if (!title.value.trim()) {
      showStatus("Please enter a title.", "error");
      title.focus();
      return;
    }

    const previous = { ...clip };

    Object.assign(clip, {
      title: title.value.trim(),
      category: category.value,
      folder: folder.value.trim() || "My Clips",
      content: content.value,
      checklist: null
    });

    if (saveClips()) {
      rememberLastWork(clip);
      refreshFilters();
      renderAll();
      showStatus("Changes saved.", "success");
    } else {
      Object.assign(clip, previous);
    }
  });
}

function toggleWaiting(id) {
  const clip = clips.find(item => item.id === id);
  if (!clip) return;

  const previous = Boolean(clip.waiting);
  clip.waiting = !previous;

  if (saveClips()) {
    renderAll();
    showStatus(
      clip.waiting ? "Added to Waiting On." : "Removed from Waiting On.",
      "success"
    );
  } else {
    clip.waiting = previous;
  }
}

function toggleChecklist(id) {
  const clip = clips.find(item => item.id === id);
  if (!clip) return;

  const previousChecklist = clip.checklist;
  const previousContent = clip.content;

  if (Array.isArray(clip.checklist)) {
    clip.content = clip.checklist
      .map(item => item.text)
      .join("\n");
    clip.checklist = null;
  } else {
    const lines = (clip.content || "")
      .split(/\r\n|\n|\r|\u2028|\u2029/)
      .map(line => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      showStatus(
        "Add some lines of text before making a checklist. You can also add items one at a time after creating it.",
        "error"
      );
      return;
    }

    clip.checklist = lines.map(text => ({
      text,
      done: false
    }));
  }

  if (saveClips()) {
    rememberLastWork(clip);
    renderAll();
    showStatus(
      Array.isArray(clip.checklist)
        ? "Checklist created. Use Add Item to add more."
        : "Checklist changed back to text.",
      "success"
    );
  } else {
    clip.checklist = previousChecklist;
    clip.content = previousContent;
  }
}

function deleteClip(id) {
  const index = clips.findIndex(item => item.id === id);
  if (index < 0) return;

  const deleted = clips[index];
  clips.splice(index, 1);

  if (saveClips()) {
    undoDelete = { clip: deleted, index };

    // renderLastWork checks whether its saved clip still exists.
    refreshFilters();
    renderAll();

    showStatus("Clip deleted.", "success", restoreDeletedClip);
  } else {
    clips.splice(index, 0, deleted);
  }
}

function restoreDeletedClip() {
  if (!undoDelete) return;

  clips.splice(
    Math.min(undoDelete.index, clips.length),
    0,
    undoDelete.clip
  );

  if (saveClips()) {
    undoDelete = null;
    refreshFilters();
    renderAll();
    showStatus("Clip restored.", "success");
  }
}

async function pasteFromClipboard() {
  if (!window.isSecureContext) {
    showStatus(
      "Clipboard reading requires the secure HTTPS version of ClipNest. Open the live GitHub Pages address in Chrome.",
      "error"
    );
    contentInput.focus();
    return;
  }

  try {
    if (!navigator.clipboard) {
      throw new Error("Clipboard API unavailable");
    }

    let pastedText = "";

    // First try the standard text-reading method.
    if (navigator.clipboard.readText) {
      try {
        pastedText = await navigator.clipboard.readText();
      } catch (readTextError) {
        // Try the alternate Clipboard API method below.
      }
    }

    // Alternate attempt for browsers supporting clipboard.read().
    if (!pastedText && navigator.clipboard.read) {
      const items = await navigator.clipboard.read();

      for (const item of items) {
        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          pastedText = await blob.text();
          break;
        }
      }
    }

    if (!pastedText) {
      throw new Error("No readable text was returned");
    }

    contentInput.value = pastedText;
    contentInput.dispatchEvent(
      new Event("input", { bubbles: true })
    );
    contentInput.focus();

    showStatus("Pasted from clipboard.", "success");
  } catch {
    contentInput.focus();

    showStatus(
      "Chrome did not allow ClipNest to read the clipboard. Check Chrome's site permissions for ClipNest and allow clipboard access. You can also copy the text again and use Paste inside the Content box.",
      "error"
    );
  }
}

function exportBackup() {
  const blob = new Blob(
    [JSON.stringify(clips, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "clipnest-backup.json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showStatus("Backup exported.", "success");
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      if (
        !Array.isArray(imported) ||
        !imported.every(item =>
          item && typeof item.content === "string"
        )
      ) {
        throw new Error("Invalid backup");
      }

      pendingImport = imported.map((item, index) => ({
        id: String(item.id || (Date.now() + "-" + index)),
        title: String(item.title || "Untitled Clip"),
        category: String(item.category || "Other"),
        folder: String(item.folder || "My Clips"),
        content: item.content,
        created: item.created || new Date().toISOString(),
        reminderDate: item.reminderDate || "",
        waiting: Boolean(item.waiting),
        checklist: Array.isArray(item.checklist)
          ? item.checklist.map(entry => ({
              text: String(entry.text || ""),
              done: Boolean(entry.done)
            }))
          : null
      }));

      showImportConfirmation();
    } catch {
      showStatus(
        "That file isn't a valid ClipNest backup. Choose a ClipNest JSON backup.",
        "error"
      );
    }

    event.target.value = "";
  };

  reader.onerror = () => {
    showStatus("Couldn't read that backup file.", "error");
    event.target.value = "";
  };

  reader.readAsText(file);
}

function showImportConfirmation() {
  const panel = $("importConfirmation");
  panel.hidden = false;
  panel.replaceChildren();

  const message = document.createElement("p");
  message.textContent =
    "This backup contains " + pendingImport.length +
    " clips. Replacing your current library cannot be undone.";

  panel.append(
    message,
    makeButton("Replace My Library", () => {
      const previous = clips;
      clips = pendingImport;

      if (saveClips()) {
        pendingImport = null;
        panel.hidden = true;
        refreshFilters();
        renderAll();
        showStatus("Backup imported successfully.", "success");
      } else {
        clips = previous;
      }
    }, "danger"),

    makeButton("Cancel", () => {
      pendingImport = null;
      panel.hidden = true;
      showStatus("Import cancelled.");
    }, "secondary")
  );
}

// Connect the page controls.
form.addEventListener("submit", addClip);
searchInput.addEventListener("input", renderClips);
categoryFilter.addEventListener("change", renderClips);
folderFilter.addEventListener("change", renderClips);

$("pasteButton").addEventListener("click", pasteFromClipboard);
$("exportButton").addEventListener("click", exportBackup);
backupFile.addEventListener("change", importBackup);
$("quickCaptureButton").addEventListener("click", quickCapture);

// Start ClipNest.
refreshFilters();
renderAll();
