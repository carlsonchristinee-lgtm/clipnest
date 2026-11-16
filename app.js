
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

const form = document.getElementById("clipForm");
const titleInput = document.getElementById("clipTitle");
const categoryInput = document.getElementById("clipCategory");
const folderInput = document.getElementById("clipFolder");
const contentInput = document.getElementById("clipContent");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const folderFilter = document.getElementById("folderFilter");
const clipList = document.getElementById("clipList");
const statusMessage = document.getElementById("statusMessage");
const backupFile = document.getElementById("backupFile");

const quickCaptureContent = document.getElementById("quickCaptureContent");
const quickCaptureButton = document.getElementById("quickCaptureButton");
const lastWorkText = document.getElementById("lastWorkText");
const reminderList = document.getElementById("reminderList");
const waitingList = document.getElementById("waitingList");

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
  if (!lastWorkText) return;

  try {
    const last = JSON.parse(localStorage.getItem(LAST_WORK_KEY) || "null");

    if (!last) {
      lastWorkText.textContent =
        "Your last opened or edited clip will appear here.";
      return;
    }

    const date = new Date(last.date);
    lastWorkText.textContent =
      last.action + ": " + last.title + " — " +
      date.toLocaleString();
  } catch {
    lastWorkText.textContent = "Your last opened or edited clip will appear here.";
  }
}

function addClip(event) {
  event.preventDefault();

  const content = contentInput.value.trim();

  if (!content) {
    showStatus("Please enter something to save.", "error");
    return;
  }

  const clip = {
    id: makeId(),
    title: titleInput.value.trim() || "Untitled Clip",
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

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString() + Math.random().toString(16).slice(2);
}

function makeButton(label, action, className = "") {
  const button = document.createElement("button");
  button.textContent = label;
  button.type = "button";
  button.className = className;
  button.addEventListener("click", action);
  return button;
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
  categories.forEach(v => categoryFilter.add(new Option(v, v)));

  folderFilter.replaceChildren(new Option("All Folders", ""));
  folders.forEach(v => folderFilter.add(new Option(v, v)));

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
  const search = searchInput.value.toLowerCase().trim();
  const category = categoryFilter.value;
  const folder = folderFilter.value;

  const filtered = clips.filter(clip => {
    const checklistText = Array.isArray(clip.checklist)
      ? clip.checklist.map(item => item.text).join(" ")
      : "";

    const matchesSearch = [
      clip.title,
      clip.category,
      clip.folder,
      clip.content,
      checklistText
    ].some(value =>
      String(value || "").toLowerCase().includes(search)
    );

    return matchesSearch &&
      (!category || (clip.category || "Other") === category) &&
      (!folder || (clip.folder || "My Clips") === folder);
  });

  clipList.replaceChildren();

  if (!filtered.length) {
    clipList.textContent = clips.length
      ? "No clips match your search or filters."
      : "No clips found. Add your first clip!";
    return;
  }

  filtered.forEach(clip => {
    const card = document.createElement("article");
    card.className = "clip clip-card";

    const heading = document.createElement("h3");
    heading.textContent = clip.title;
    heading.tabIndex = 0;
    heading.title = "Open this clip";
    heading.addEventListener("click", () => rememberLastWork(clip));

    const details = document.createElement("small");
    details.textContent =
      (clip.category || "Other") + " • " +
      (clip.folder || "My Clips");

    card.append(heading, details);

    if (clip.waiting) {
      const waitingTag = document.createElement("p");
      waitingTag.textContent = "⏳ Waiting on someone";
      card.appendChild(waitingTag);
    }

    if (clip.reminderDate) {
      const reminderTag = document.createElement("p");
      reminderTag.textContent =
        "📅 Reminder: " + formatDate(clip.reminderDate);
      card.appendChild(reminderTag);
    }

    if (Array.isArray(clip.checklist)) {
      renderChecklist(card, clip);
    } else {
      const content = document.createElement("p");
      content.className = "clip-content";
      content.textContent = clip.content;
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
        Array.isArray(clip.checklist) ? "Turn off Checklist" : "Make Checklist",
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

    if (item.done) text.style.textDecoration = "line-through";

    label.append(checkbox, text);
    card.appendChild(label);
  });
}

function renderReminders() {
  if (!reminderList) return;

  reminderList.replaceChildren();

  const upcoming = clips
    .filter(clip => clip.reminderDate)
    .sort((a, b) =>
      a.reminderDate.localeCompare(b.reminderDate)
    );

  if (!upcoming.length) {
    reminderList.textContent = "No reminders yet.";
    return;
  }

  upcoming.forEach(clip => {
    const item = document.createElement("p");
    item.textContent =
      formatDate(clip.reminderDate) + " — " + clip.title;
    item.tabIndex = 0;
    item.addEventListener("click", () => rememberLastWork(clip));
    reminderList.appendChild(item);
  });
}

function renderWaiting() {
  if (!waitingList) return;

  waitingList.replaceChildren();

  const waiting = clips.filter(clip => clip.waiting);

  if (!waiting.length) {
    waitingList.textContent = "Nothing waiting right now.";
    return;
  }

  waiting.forEach(clip => {
    const item = document.createElement("p");
    item.textContent = clip.title;
    item.tabIndex = 0;
    item.addEventListener("click", () => rememberLastWork(clip));
    waitingList.appendChild(item);
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
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error("Unavailable");
    }

    await navigator.clipboard.writeText(clip.content);
    rememberLastWork(clip);
    showStatus("Copied!", "success");
  } catch {
    showStatus(
      "Clipboard access isn't available. Open ClipNest over HTTPS, or copy the text manually.",
      "error"
    );
  }
}

function editClip(id) {
  const clip = clips.find(item => item.id === id);
  if (!clip) return;

  rememberLastWork(clip);

  const card = [...clipList.querySelectorAll(".clip")]
    .find(el => el.querySelector("h3")?.textContent === clip.title);

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
    makeButton("Cancel", renderClips, "secondary")
  );

  card.replaceChildren(editor);

  editor.addEventListener("submit", event => {
    event.preventDefault();

    const previous = { ...clip };

    Object.assign(clip, {
      title: title.value.trim() || "Untitled Clip",
      category: category.value,
      folder: folder.value.trim() || "My Clips",
      content: content.value
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

  const previous = clip.checklist;

  if (Array.isArray(clip.checklist)) {
    clip.content = clip.checklist.map(item => item.text).join("\n");
    clip.checklist = null;
  } else {
    const lines = (clip.content || "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      showStatus("Add some lines of text before making a checklist.", "error");
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
        ? "Checklist created."
        : "Checklist changed back to text.",
      "success"
    );
  } else {
    clip.checklist = previous;
  }
}

function deleteClip(id) {
  const index = clips.findIndex(item => item.id === id);
  if (index < 0) return;

  const deleted = clips[index];
  clips.splice(index, 1);

  if (saveClips()) {
    undoDelete = { clip: deleted, index };

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

function quickCapture() {
  const content = quickCaptureContent.value.trim();

  if (!content) {
    showStatus("Type or paste something first.", "error");
    quickCaptureContent.focus();
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
    quickCaptureContent.value = "";
    refreshFilters();
    renderAll();
    rememberLastWork(clip);
    showStatus("Quick Capture saved to Inbox!", "success");
  } else {
    clips = clips.filter(item => item.id !== clip.id);
  }
}

async function pasteFromClipboard() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      throw new Error("Unavailable");
    }

    contentInput.value = await navigator.clipboard.readText();
    contentInput.focus();
    showStatus("Pasted from clipboard.", "success");
  } catch {
    showStatus(
      "Your browser blocked clipboard access. Tap the content box, then use your phone's Paste option.",
      "error"
    );
    contentInput.focus();
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
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      if (
        !Array.isArray(imported) ||
        !imported.every(item =>
          item &&
          typeof item.content === "string"
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
  const panel = document.getElementById("importConfirmation");
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

form.addEventListener("submit", addClip);
searchInput.addEventListener("input", renderClips);
categoryFilter.addEventListener("change", renderClips);
folderFilter.addEventListener("change", renderClips);

document.getElementById("pasteButton")
  .addEventListener("click", pasteFromClipboard);

document.getElementById("exportButton")
  .addEventListener("click", exportBackup);

backupFile.addEventListener("change", importBackup);

if (quickCaptureButton) {
  quickCaptureButton.addEventListener("click", quickCapture);
}

refreshFilters();
renderAll();
