import { updateFilters, getFilterKey } from "./dataUtility.mjs";

const FILTER_KEY = getFilterKey();

$(document).ready(function () {
  // Load the start categories from the backend
  const startCategories = $("#toggle-menu-container").data("start-categories") || ["INFO"];

  // ----------------------------
  // Helpers
  // ----------------------------
  function normalizeFilters(f) {
    const filters = f && typeof f === "object" ? f : {};
    filters.valueFilters = Array.isArray(filters.valueFilters) ? filters.valueFilters : [];
    filters.rangeFilters = filters.rangeFilters && typeof filters.rangeFilters === "object" ? filters.rangeFilters : {};
    filters.exclusiveFilters = Array.isArray(filters.exclusiveFilters) ? filters.exclusiveFilters : [];
    filters.categoryFilters = Array.isArray(filters.categoryFilters) ? filters.categoryFilters : [];

    // Always keep INFO in categoryFilters
    if (!filters.categoryFilters.includes("INFO")) {
      filters.categoryFilters.unshift("INFO");
    }
    // Deduplicate
    filters.categoryFilters = Array.from(new Set(filters.categoryFilters));

    return filters;
  }

  function loadFiltersOrNull() {
    const raw = window.sessionStorage.getItem(FILTER_KEY);
    if (!raw) return null;
    try {
      return normalizeFilters(JSON.parse(raw));
    } catch (e) {
      // If corrupted JSON, do NOT overwrite existing storage here
      console.warn("[filters] Failed to parse sessionStorage filters:", e);
      return null;
    }
  }

  function loadOrInitFilters() {
    // If exists, use it (normalized)
    const existing = loadFiltersOrNull();
    if (existing) return existing;

    // Otherwise init fresh (but ONLY when truly missing)
    const init = normalizeFilters({
      valueFilters: [],
      rangeFilters: {},
      exclusiveFilters: [],
      categoryFilters: [],
    });

    // If no column selection, initialize from backend startCategories
    const initCats = Array.isArray(startCategories) && startCategories.length ? startCategories : ["INFO"];
    init.categoryFilters = Array.from(new Set(["INFO", ...initCats]));
    updateFilters(init, FILTER_KEY);
    return init;
  }

  function saveFilters(filters) {
    updateFilters(normalizeFilters(filters), FILTER_KEY);
  }

  function applyCheckboxStates(categoryFilters) {
    const cats = Array.isArray(categoryFilters) ? categoryFilters : [];
    $(".column-filter").each((_, element) => {
      const id = $(element).attr("id");
      $(element).prop("checked", cats.includes(id));
    });
  }

  // ----------------------------
  // Initial load / checkbox sync
  // ----------------------------
  let filters = loadOrInitFilters();

  // If still no categories (edge case), set to startCategories and persist without touching other filters
  if (!filters.categoryFilters || filters.categoryFilters.length === 0) {
    filters.categoryFilters = Array.from(new Set(["INFO", ...(startCategories || [])]));
    saveFilters(filters);
  }

  applyCheckboxStates(filters.categoryFilters);

  // ----------------------------
  // Events
  // ----------------------------

  // Checkbox changed
  $(".column-filter").on("change", function () {
    const f = loadFiltersOrNull();
    if (!f) {
      // IMPORTANT: do not overwrite storage with empty defaults
      return;
    }

    const id = $(this).attr("id");
    if (!id) return;

    // INFO must always stay selected
    if (id === "INFO") {
      $(this).prop("checked", true);
      if (!f.categoryFilters.includes("INFO")) f.categoryFilters.unshift("INFO");
      f.categoryFilters = Array.from(new Set(f.categoryFilters));
      saveFilters(f);
      return;
    }

    if (this.checked) {
      if (!f.categoryFilters.includes(id)) f.categoryFilters.push(id);
    } else {
      const idx = f.categoryFilters.indexOf(id);
      if (idx !== -1) f.categoryFilters.splice(idx, 1);
    }

    // Ensure INFO is still present
    if (!f.categoryFilters.includes("INFO")) f.categoryFilters.unshift("INFO");
    f.categoryFilters = Array.from(new Set(f.categoryFilters));

    saveFilters(f);
  });

  // Select All
  $("#toggleSelectAllColumns").on("click", function () {
    const f = loadFiltersOrNull() || loadOrInitFilters(); // select-all implies we can init if missing

    const selected = new Set(["INFO"]);
    $("#columnToggles .column-filter").each((_, element) => {
      element.checked = true;
      const id = $(element).attr("id");
      if (id) selected.add(id);
    });

    f.categoryFilters = Array.from(selected);
    saveFilters(f);

    // Keep UI consistent
    applyCheckboxStates(f.categoryFilters);

    $(".form-check-input.column-filter").first().trigger("change");
  });

  // Deselect All (but keep INFO)
  $("#toggleDeselectAllColumns").on("click", function () {
    const f = loadFiltersOrNull() || loadOrInitFilters(); // deselect implies we can init if missing

    $("#columnToggles .column-filter").each((_, element) => {
      const id = $(element).attr("id");
      element.checked = id === "INFO";
    });

    f.categoryFilters = ["INFO"];
    saveFilters(f);

    applyCheckboxStates(f.categoryFilters);

    $(".form-check-input.column-filter").first().trigger("change");
  });

  // Reset columns to backend startCategories (but do NOT clear value/range/exclusive filters)
  $("#reset-filters-button").on("click", function () {
    const f = loadFiltersOrNull() || loadOrInitFilters(); // reset implies we can init if missing

    const resetCats = Array.isArray(startCategories) && startCategories.length ? startCategories : ["INFO"];
    f.categoryFilters = Array.from(new Set(["INFO", ...resetCats]));
    saveFilters(f);

    applyCheckboxStates(f.categoryFilters);

    $(".form-check-input.column-filter").first().trigger("change");
  });

  // Toggle menu visibility
  $("#select-filter-button").on("click", function () {
    $("#toggle-menu-container").toggleClass("visible-filters");
  });
});
