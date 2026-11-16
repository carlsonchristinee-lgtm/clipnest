
const STORAGE_KEY = "clipnest_items";
let clips = [];

try {
  clips = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!Array.isArray(clips)) clips = [];
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
let pendingImport = null;

function showStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message " + type;
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

function addClip(event) {
  event.preventDefault();
  const content = contentInput.value.trim();

  if (!content) {
    showStatus("Please enter something to save.", "error");
    return;
  }

  clips.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    title: titleInput.value.trim() || "Untitled Clip",
    category: categoryInput.value,
    folder: folderInput.value.trim() || "My Clips",
    content,
    created: new Date().toISOString()
  });

  if (saveClips()) {
    form.reset();
    refreshFilters();
    renderClips();
    showStatus("Clip saved!", "success");
  }
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

  const categories = [...new Set(clips.map(c => c.category || "Other"))].sort();
  const folders = [...new Set(clips.map(c => c.folder || "My Clips"))].sort();

  categoryFilter.replaceChildren(new Option("All categories", ""));
  categories.forEach(v => categoryFilter.add(new Option(v, v)));

  folderFilter.replaceChildren(new Option("All folders", ""));
  folders.forEach(v => folderFilter.add(new Option(v, v)));

  categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : "";
  folderFilter.value = folders.includes(selectedFolder) ? selectedFolder : "";
}

function renderClips() {
  const search = searchInput.value.toLowerCase().trim();
  const category = categoryFilter.value;
  const folder = folderFilter.value;

  const filtered = clips.filter(clip => {
    const matchesSearch = [clip.title, clip.category, clip.folder, clip.content]
      .some(value => String(value || "").toLowerCase().includes(search));

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
    card.className = "clip";

    const heading = document.createElement("h3");
    heading.textContent = clip.title;

    const details = document.createElement("small");
    details.textContent = (clip.category || "Other") + " • " + (clip.folder || "My Clips");

    const content = document.createElement("p");
    content.className = "clip-content";
    content.textContent = clip.content;

    card.append(
      heading,
      details,
      content,
      makeButton("Copy", () => copyClip(clip)),
      makeButton("Edit", () => editClip(clip.id)),
      makeButton("Delete", () => deleteClip(clip.id), "danger")
    );

    clipList.appendChild(card);
  });
}

async function copyClip(clip) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error("Unavailable");
    }

    await navigator.clipboard.writeText(clip.content);
    showStatus("Copied!", "success");
  } catch {
    showStatus("Clipboard access isn't available. Open ClipNest over HTTPS, or copy the text manually.", "error");
  }
}

function editClip(id) {
  const clip = clips.find(item => item.id === id);
  if (!clip) return;

  const card = [...clipList.querySelectorAll(".clip")].find(el =>
    el.querySelector("h3")?.textContent === clip.title &&
    el.querySelector(".clip-content")?.textContent === clip.content
  );

  if (!card) return;

  const editor = document.createElement("form");
  editor.className = "edit-form";

  const title = document.createElement("input");
  title.value = clip.title;
  title.setAttribute("aria-label", "Clip title");

  const category = document.createElement("select");

  ["Text", "Image", "Link", "AI Prompt", "Caption", "Other"].forEach(v =>
    category.add(new Option(v, v))
  );

  category.value = clip.category || "Other";
  category.setAttribute("aria-label", "Category");

  const folder = document.createElement("input");
  folder.value = clip.folder || "My Clips";
  folder.placeholder = "Folder";
  folder.setAttribute("aria-label", "Folder");

  const content = document.createElement("textarea");
  content.value = clip.content;
  content.setAttribute("aria-label", "Clip content");

  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save changes";

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
      refreshFilters();
      renderClips();
      showStatus("Changes saved.", "success");
    } else {
      Object.assign(clip, previous);
    }
  });
}

function deleteClip(id) {
  const previous = clips;
  clips = clips.filter(item => item.id !== id);

  if (saveClips()) {
    refreshFilters();
    renderClips();
    showStatus("Clip deleted.", "success");
  } else {
    clips = previous;
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
    showStatus("Clipboard access isn't available. Tap the content box and paste manually.", "error");
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

  setTimeout(() => URL.revokeObjectURL(url), 1000);

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
          typeof item.title === "string" &&
          typeof item.content === "string"
        )
      ) {
        throw new Error("Invalid backup");
      }

      pendingImport = imported.map((item, i) => ({
        id: String(item.id || (Date.now() + "-" + i)),
        title: item.title,
        category: String(item.category || "Other"),
        folder: String(item.folder || "My Clips"),
        content: item.content,
        created: item.created || new Date().toISOString()
      }));

      showImportConfirmation();

    } catch {
      showStatus("This is not a valid ClipNest backup.", "error");
    }

    event.target.value = "";
  };

  reader.onerror = () => showStatus("Couldn't read that backup file.", "error");

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
    makeButton("Replace my library", () => {
      const previous = clips;
      clips = pendingImport;

      if (saveClips()) {
        pendingImport = null;
        panel.hidden = true;
        refreshFilters();
        renderClips();
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

refreshFilters();
renderClips();
