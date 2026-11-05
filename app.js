
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
const clipList = document.getElementById("clipList");

function saveClips() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clips));
    return true;
  } catch (error) {
    alert("Unable to save. Your browser storage may be full.");
    return false;
  }
}

function addClip(event) {
  event.preventDefault();

  const content = contentInput.value.trim();

  if (!content) {
    alert("Please enter something to save.");
    return;
  }

  clips.unshift({
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(),
    title: titleInput.value.trim() || "Untitled Clip",
    category: categoryInput.value,
    folder: folderInput.value.trim() || "My Clips",
    content,
    created: new Date().toISOString()
  });

  if (saveClips()) {
    form.reset();
    renderClips();
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

function renderClips() {
  const search = searchInput.value.toLowerCase().trim();

  const filtered = clips.filter(clip =>
    [clip.title, clip.category, clip.folder, clip.content]
      .some(value =>
        String(value || "").toLowerCase().includes(search)
      )
  );

  clipList.replaceChildren();

  if (filtered.length === 0) {
    clipList.textContent = "No clips found. Add your first clip!";
    return;
  }

  filtered.forEach(clip => {
    const card = document.createElement("article");
    card.className = "clip";

    const heading = document.createElement("h3");
    heading.textContent = clip.title;

    const details = document.createElement("small");
    details.textContent = `${clip.category} • ${clip.folder}`;

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
    await navigator.clipboard.writeText(clip.content);
    alert("Clip copied!");
  } catch {
    alert("Clipboard access unavailable. Try copying manually.");
  }
}

function editClip(id) {
  const clip = clips.find(item => item.id === id);
  if (!clip) return;

  const title = prompt("Clip title:", clip.title);
  if (title === null) return;

  const folder = prompt("Folder:", clip.folder);
  if (folder === null) return;

  const content = prompt("Clip content:", clip.content);
  if (content === null) return;

  const previous = { ...clip };

  clip.title = title.trim() || "Untitled Clip";
  clip.folder = folder.trim() || "My Clips";
  clip.content = content;

  if (!saveClips()) {
    Object.assign(clip, previous);
  }

  renderClips();
}

function deleteClip(id) {
  if (!confirm("Are you sure you want to delete this clip?")) return;

  const previous = clips;
  clips = clips.filter(item => item.id !== id);

  if (saveClips()) {
    renderClips();
  } else {
    clips = previous;
  }
}

async function pasteFromClipboard() {
  try {
    contentInput.value = await navigator.clipboard.readText();
    contentInput.focus();
  } catch {
    alert("Clipboard access unavailable. You can paste manually.");
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
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importBackup(event) {
  const file = event.target.files[0];
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

      if (!confirm("Replace your current clips with this backup?")) {
        return;
      }

      const previous = clips;

      clips = imported.map((item, index) => ({
        id: String(item.id || `${Date.now()}-${index}`),
        title: item.title,
        category: String(item.category || "Other"),
        folder: String(item.folder || "My Clips"),
        content: item.content,
        created: item.created || new Date().toISOString()
      }));

      if (saveClips()) {
        renderClips();
        alert("Backup imported successfully!");
      } else {
        clips = previous;
      }
    } catch {
      alert("This is not a valid ClipNest backup.");
    }

    event.target.value = "";
  };

  reader.readAsText(file);
}

form.addEventListener("submit", addClip);
searchInput.addEventListener("input", renderClips);

renderClips();
