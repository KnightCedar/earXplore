// Get data.
const dataEl = document.getElementById("sensorPositionData");
const data = dataEl ? JSON.parse(dataEl.textContent) : [];

const SENSOR_POSITION_COLUMN = "Sensor Position";

// Position of dots
const sensorPositions = [
  { id: "helix", label: "On the ear helix", x: 37, y: 53, value: "On the ear helix" },
  { id: "ear_canal", label: "Ear Canal", x: 55, y: 54.8, value: "Ear Canal" },
  { id: "behind_the_ear", label: "Behind the ear", x: 62.5, y: 80, value: "Behind the ear" },
  { id: "around_the_ear", label: "Around the ear", x: 58, y: 28.5, value: "Around the ear" },
  { id: "ear_concha", label: "Ear Concha", x: 48, y: 47.5, value: "Ear Concha" },
  { id: "earlobe", label: "Earlobe", x: 53, y: 77, value: "Earlobe" },
  { id: "headphone_type", label: "Headphone type", x: 43, y: 11.5, value: "Headphone type" },
  { id: "head_mounted", label: "Head-mounted", x: 43, y: 5, value: "Head-mounted" },
];

// -
function normalizeCell(cell) {
  return String(cell)
    .split(/[,;]+/)
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

function filterStudiesBySensorPosition(positionValue) {
  const target = String(positionValue).toLowerCase();
  return data.filter(row => {
    const cell = row[SENSOR_POSITION_COLUMN];
    if (!cell || cell === "N/A") return false;
    return normalizeCell(cell).includes(target);
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStudyDetail(study) {
  const detailEl = document.getElementById("sensorPositionStudyDetail");
  const detailTitleEl = document.getElementById("sensorPositionDetailTitle");
  if (!detailEl) return;

  if (!study) {
    if (detailTitleEl) detailTitleEl.style.display = "none";
    detailEl.innerHTML = "";
    return;
  }

  if (detailTitleEl) detailTitleEl.style.display = "block";

  const keys = Object.keys(study).sort((a, b) => a.localeCompare(b));

  const rowsHtml = keys.map((k) => {
    const raw = study[k];
    const valueStr = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");

    // 自动识别链接
    const trimmed = valueStr.trim();
    const isLink = /^https?:\/\//i.test(trimmed);

    const valueHtml = isLink
      ? `<a href="${escapeHtml(trimmed)}" target="_blank" rel="noopener noreferrer">${escapeHtml(trimmed)}</a>`
      : `<span>${escapeHtml(valueStr)}</span>`;

    return `
      <tr>
        <th style="text-align:left;vertical-align:top;padding:8px;border:1px solid #eee;background:#fafafa;width:35%;">
          ${escapeHtml(k)}
        </th>
        <td style="padding:8px;border:1px solid #eee;">
          ${valueHtml}
        </td>
      </tr>
    `;
  }).join("");

  detailEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

// Render the result
function renderStudies(studies) {
  const listEl = document.getElementById("sensorPositionStudies");
  if (!listEl) return;

  // 每次刷新列表，先清空详情
  renderStudyDetail(null);

  if (!studies.length) {
    listEl.innerHTML = `<div class="text-muted">No studies found.</div>`;
    return;
  }

  listEl.innerHTML = studies
    .slice(0, 100)
    .map((s, idx) => {
      const id = s.ID ?? `#${idx + 1}`;
      const pos = s[SENSOR_POSITION_COLUMN] ?? "";
      const year = s.Year ?? "";
      return `
        <button
          type="button"
          class="study-item"
          data-idx="${idx}"
          style="display:block;width:100%;text-align:left;padding:10px;border:1px solid #eee;border-radius:10px;margin:8px 0;background:white;cursor:pointer;"
        >
          <div style="font-weight:600;">Study ${escapeHtml(id)}</div>
          <div style="font-size:12px;opacity:.8;">${escapeHtml(year)}${year ? " · " : ""}${escapeHtml(pos)}</div>
        </button>
      `;
    })
    .join("");

  listEl.onclick = (e) => {
    const btn = e.target.closest(".study-item");
    if (!btn) return;

    const idx = Number(btn.dataset.idx);
    const selected = studies[idx];
    renderStudyDetail(selected);

    // Highlight the selected study
    listEl.querySelectorAll(".study-item").forEach(el => el.style.outline = "none");
    btn.style.outline = "2px solid rgba(217, 83, 79, 0.35)";
  };

  // Default: select the first study
  renderStudyDetail(studies[0]);
}

// Highlight the selected point.
function setActiveDot(activeId) {
  document.querySelectorAll(".sensor-position-dot").forEach(dot => {
    dot.classList.toggle("is-active", dot.dataset.id === activeId);
  });
}

// Select the position
function onSelectPosition(pos) {
  setActiveDot(pos.id);

  const titleEl = document.getElementById("sensorPositionTitle");
  if (titleEl) titleEl.textContent = `Selected: ${pos.label}`;

  const results = filterStudiesBySensorPosition(pos.value);
  renderStudies(results);
}

// Generate red dots.
function createDot(pos, earWrapper) {
  const dot = document.createElement("div");
  dot.className = "sensor-position-dot";
  dot.style.left = `${pos.x}%`;
  dot.style.top = `${pos.y}%`;
  dot.title = pos.label;
  dot.dataset.id = pos.id;

  dot.tabIndex = 0;
  dot.setAttribute("role", "button");
  dot.setAttribute("aria-label", pos.label);

  dot.addEventListener("click", () => onSelectPosition(pos));
  dot.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectPosition(pos);
    }
  });

  earWrapper.appendChild(dot);
}

document.addEventListener("DOMContentLoaded", () => {
  const earWrapper = document.getElementById("earWrapper");
  if (!earWrapper) {
    console.warn("earWrapper not found");
    return;
  }

  sensorPositions.forEach(pos => createDot(pos, earWrapper));

  console.log("dots inserted:", document.querySelectorAll(".sensor-position-dot").length);
});