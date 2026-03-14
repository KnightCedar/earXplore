// Get data
const dataEl = document.getElementById("sensorPositionData");
const data = dataEl ? JSON.parse(dataEl.textContent) : [];

const SENSOR_POSITION_COLUMN = "Sensor Position";
let activeSensorPosition = null;

// Position of dots
const sensorPositions = [
  { id: "helix", label: "On the ear helix", x: 37, y: 53, value: "On the ear helix" },
  { id: "ear_canal", label: "Ear Canal", x: 55, y: 64, value: "Ear Canal" },
  { id: "behind_the_ear", label: "Behind the ear", x: 62.5, y: 80, value: "Behind the ear" },
  { id: "around_the_ear", label: "Around the ear", x: 58, y: 28.5, value: "Around the ear" },
  { id: "ear_concha", label: "Ear Concha", x: 51, y: 50, value: "Ear Concha" },
  { id: "earlobe", label: "Earlobe", x: 53, y: 77, value: "Earlobe" },
  { id: "headphone_type", label: "Headphone type", x: 43, y: 11.5, value: "Headphone type" },
  { id: "head_mounted", label: "Head-mounted", x: 43, y: 5, value: "Head-mounted" },
];

function normalizeCell(cell) {
  return String(cell)
    .split(/[,;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseNumber(value) {
  if (value == null) return NaN;
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function getCheckboxFilterState() {
  const state = {};

  document.querySelectorAll(".filter-group[data-col]").forEach((group) => {
    const col = group.dataset.col;
    if (!col) return;

    const inputs = Array.from(group.querySelectorAll(".value-filter"));
    if (!inputs.length) return;

    state[col] = {
      selectedValues: inputs
        .filter((input) => input.checked)
        .map((input) => String(input.value).trim().toLowerCase()),
    };
  });

  return state;
}

function getActiveSliderFilters() {
  const sliders = {};

  document.querySelectorAll(".range-slider").forEach((sliderEl) => {
    if (!sliderEl.noUiSlider) return;

    const col = sliderEl.dataset.col;
    if (!col) return;

    const values = sliderEl.noUiSlider.get();
    if (!Array.isArray(values) || values.length < 2) return;

    const min = parseFloat(values[0]);
    const max = parseFloat(values[1]);

    if (Number.isFinite(min) && Number.isFinite(max)) {
      sliders[col] = [min, max];
    }
  });

  return sliders;
}

function rowMatchesCheckboxFilters(row, checkboxFilterState) {
  for (const [col, { selectedValues }] of Object.entries(checkboxFilterState)) {
    if (!selectedValues.length) {
      return false;
    }

    const raw = row[col];
    if (raw == null || raw === "" || raw === "N/A") return false;

    const normalizedCell = normalizeCell(raw);
    const matched = selectedValues.some((v) => normalizedCell.includes(v));

    if (!matched) return false;
  }

  return true;
}

function rowMatchesSliderFilters(row, sliderFilters) {
  for (const [col, [min, max]] of Object.entries(sliderFilters)) {
    const raw = row[col];
    const value = parseNumber(raw);

    if (!Number.isFinite(value)) return false;
    if (value < min || value > max) return false;
  }

  return true;
}

function rowMatchesSensorPosition(row, positionValue) {
  if (!positionValue) return true;

  const target = String(positionValue).trim().toLowerCase();
  const cell = row[SENSOR_POSITION_COLUMN];

  if (!cell || cell === "N/A") return false;
  return normalizeCell(cell).includes(target);
}

function getFilteredStudies() {
  const checkboxFilterState = getCheckboxFilterState();
  const sliderFilters = getActiveSliderFilters();

  return data.filter((row) => {
    if (!rowMatchesCheckboxFilters(row, checkboxFilterState)) return false;
    if (!rowMatchesSliderFilters(row, sliderFilters)) return false;
    if (activeSensorPosition && !rowMatchesSensorPosition(row, activeSensorPosition.value)) return false;
    return true;
  });
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

function renderStudies(studies) {
  const listEl = document.getElementById("sensorPositionStudies");
  const countEl = document.getElementById("sensorPositionResultCount");
  if (!listEl) return;

  renderStudyDetail(null);

  if (countEl) {
    countEl.textContent = `${studies.length} stud${studies.length === 1 ? "y" : "ies"}`;
  }

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
      const mainAuthor = s["Main Author"] ?? "";

      return `
        <button
          type="button"
          class="study-item"
          data-idx="${idx}"
          style="display:block;width:100%;text-align:left;padding:10px;border:1px solid #eee;border-radius:10px;margin:8px 0;background:white;cursor:pointer;"
        >
          <div style="font-weight:600;">Study ${escapeHtml(id)}${mainAuthor ? ` - ${escapeHtml(mainAuthor)}` : ""}</div>
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

    listEl.querySelectorAll(".study-item").forEach((el) => {
      el.style.outline = "none";
    });
    btn.style.outline = "2px solid rgba(217, 83, 79, 0.35)";
  };

  renderStudyDetail(studies[0]);

  const firstBtn = listEl.querySelector(".study-item");
  if (firstBtn) {
    firstBtn.style.outline = "2px solid rgba(217, 83, 79, 0.35)";
  }
}

function setActiveDot(activeId) {
  document.querySelectorAll(".sensor-position-dot").forEach((dot) => {
    dot.classList.toggle("is-active", dot.dataset.id === activeId);
  });
}

function applyAllFilters() {
  const studies = getFilteredStudies();
  const container = document.getElementById("sensorPositionViewContainer");
  const titleEl = document.getElementById("sensorPositionTitle");

  if (container) {
    if (activeSensorPosition) {
      container.classList.remove("no-selection");
      container.classList.add("has-selection");
    } else {
      container.classList.remove("has-selection");
      container.classList.add("no-selection");
    }
  }

  if (titleEl) {
    titleEl.textContent = activeSensorPosition
      ? `Selected: ${activeSensorPosition.label}`
      : "No sensor position selected";
  }

  renderStudies(studies);
}

function onSelectPosition(pos) {
  activeSensorPosition = pos;
  setActiveDot(pos.id);
  applyAllFilters();
}

function clearSelectedPosition() {
  activeSensorPosition = null;
  setActiveDot(null);
  applyAllFilters();
}

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

function bindSidebarEvents() {
  document.querySelectorAll(".value-filter").forEach((el) => {
    el.addEventListener("change", applyAllFilters);
  });

  document.querySelectorAll(".form-check-input").forEach((el) => {
    el.addEventListener("change", applyAllFilters);
  });

  document.querySelectorAll(".exclusive-filter").forEach((el) => {
    el.addEventListener("click", () => setTimeout(applyAllFilters, 0));
  });

  document.querySelectorAll(".select-all, .deselect-all").forEach((el) => {
    el.addEventListener("click", () => setTimeout(applyAllFilters, 0));
  });

  document.querySelectorAll(".select-all-panel, .deselect-all-panel").forEach((el) => {
    el.addEventListener("click", () => setTimeout(applyAllFilters, 0));
  });

  const sidebarSelectAll = document.getElementById("select-all-sidebar-button");
  const sidebarDeselectAll = document.getElementById("deselect-all-sidebar-button");

  if (sidebarSelectAll) {
    sidebarSelectAll.addEventListener("click", () => setTimeout(applyAllFilters, 0));
  }
  if (sidebarDeselectAll) {
    sidebarDeselectAll.addEventListener("click", () => setTimeout(applyAllFilters, 0));
  }

  document.querySelectorAll(".range-slider").forEach((sliderEl) => {
    if (!sliderEl.noUiSlider) return;
    sliderEl.noUiSlider.on("end", applyAllFilters);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const earWrapper = document.getElementById("earWrapper");
  if (!earWrapper) {
    console.warn("earWrapper not found");
    return;
  }

  sensorPositions.forEach((pos) => createDot(pos, earWrapper));
  bindSidebarEvents();
  applyAllFilters();

  const clearBtn = document.getElementById("clearSensorPositionSelection");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearSelectedPosition);
  }

  console.log("sensor-position ready");
});