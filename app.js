
const STORAGE_KEY = "clipnest_items";

let clips = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

const form = document.getElementById("clipForm");
const titleInput = document.getElementById("clipTitle");
const categoryInput = document.getElementById("clipCategory");
const folderInput = document.getElementById("clipFolder");
const contentInput = document.getElementById("clipContent");
const searchInput = document.getElementById("searchInput");
const clipList = document.getElementById("clipList");

function saveClips() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clips));
}

function addClip(event) {
  event.preventDefault();

  const content = contentInput.value.trim();

  if (!content) {
    alert("Please enter something to save.");
    return;
  }

  const clip = {
    id: Date.now().toString(),
    title: titleInput.value.trim() || "Untitled Clip",
    category: categoryInput.value,
    folder: folderInput.value.trim() || "My Clips",
    content,
    created: new Date().toISOString()
  };

  clips.unshift(clip);
  saveClips();
  form.reset();
  renderClips();
}

function renderClips() {
  const search = searchInput.value.toLowerCase();

  const filtered = clips.filter(clip =>
    [clip.title, clip.category, clip.folder, clip.content]
      .some(value => value.toLowerCase().includes(search))
  );

  clipList.innerHTML = "";

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

    const copyButton = makeButton("Copy", () => copyClip(clip));
    const editButton = makeButton("Edit", () => editClip(clip.id));
    const deleteButton = makeButton("Delete", () => deleteClip(clip.id));
    deleteButton.className = "danger";

    card.append(heading, details, content,
      copyButton, editButton, deleteButton);

    clipList.appendChild(card);
  });
}

function makeButton(label, action) {
  const button = document.createElement("button");
  button.textContent = label;
  button.type = "button";
  button.addEventListener("click", action);
  return button;
}

async function copyClip(clip) {
  try {
    await navigator.clipboard.writeText(clip.content);
    alert("Clip copied!");
  } catch {
    alert("Copy wasn't available. You can select and copy the text manually.");
  }
}

function editClip(id) {
  const clip = clips.find(item => item.id === id);
  if (!clip) return;

  const newContent = prompt("Edit your clip:", clip.content);
  if (newContent === null) return;

  clip.content = newContent;
  saveClips();
  renderClips();
}

function deleteClip(id) {
  if (!confirm("Delete this clip?")) return;

  clips = clips.filter(item => item.id !== id);
  saveClips();
  renderClips();
}

function pasteFromClipboard() {
  navigator.clipboard.readText()
    .then(text => {
      contentInput.value = text;
      contentInput.focus();
    })
    .catch(() => alert("Clipboard access was not available."));
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
  URL.revokeObjectURL(url);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      if (!Array.isArray(imported)) {
        throw new Error("Invalid backup");
      }

      clips = imported;
      saveClips();
      renderClips();
      alert("Backup imported!");
    } catch {
      alert("That file is not a valid ClipNest backup.");
    }
  };

  reader.readAsText(file);
}

form.addEventListener("submit", addClip);
searchInput.addEventListener("input", renderClips);

renderClips();
