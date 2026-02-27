import { convertToID, updateFilters, processQuery, getFilterKey} from "./dataUtility.mjs";

const FILTER_KEY = getFilterKey();


const params = new URLSearchParams(window.location.search);

if (params.get("reset") === "1") {
 for (const k of Object.keys(sessionStorage)) {
    if (k.startsWith("filters_health")) sessionStorage.removeItem(k);
  }
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("selected_columns_health")) localStorage.removeItem(k);
  }

  sessionStorage.removeItem("filters"); // default
  sessionStorage.removeItem("modalID");

  const url = new URL(window.location.href);
  url.searchParams.delete("reset");
  window.history.replaceState({}, "", url);
}


$(document).ready(function () {

  const select = document.getElementById("healthCategorySelect");

if (select) {
  // Initialize the selected item (from data-current)）
  const current = select.dataset.current || "";
  select.value = current;

  select.addEventListener("change", () => {
    const chosen = select.value; // Revert to the default health

    // Clear the filters of the current database
    const currentKey = getFilterKey();
    sessionStorage.removeItem(currentKey);
    sessionStorage.removeItem("modalID");

    // Update the URL parameters and refresh
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "health");
    if (chosen) url.searchParams.set("health_category", chosen);
    else url.searchParams.delete("health_category");

    window.location.href = url.toString();
  });
}


  // Highlight the current view in the navbar
  const selectedView = $("nav").data("current-view");
  $(".navbar-item").each((index, element) => {
    selectedView === $(element).attr("data-section")
      ? $(element).addClass("navbar-item-selected")
      : $(element).removeClass("navbar-item-selected");
  });

  /*
  * Merge all the filters into a single object
  * This object will be used to filter the data displayed on the page
  * The filters are stored in the session storage to persist across page reloads
  * The filters are stored in the following format:
  * {valueFilters: [value1-category1, value2-category1, ..., valueN-categoryN],
  * rangeFilters: {rangeCategory: [handle1-value, handle2-value], rangeCategory2: [handle1-value], ...},
  * categoryFilters: [category1, category2, ...]} <--- will not be set here, but will be set in the respective scripts
  */

  // Load the current value filters from the session storage
  let filters = JSON.parse(window.sessionStorage.getItem(FILTER_KEY)) || null;
  if (!filters) {
    // If there isnt a filter object in session storage, create a new one
    filters = { valueFilters: [], rangeFilters: {}, exclusiveFilters: [], categoryFilters: [] };
    updateFilters(filters,FILTER_KEY);
  }

  let valueFilters = filters.valueFilters || null;
  let rangeFilters = filters.rangeFilters || null;
  let exclusiveFilters = filters.exclusiveFilters || null;

  // If there are no value filters in session storage, meaning user is visiting for the first time, default to all value filters being selected
  if (!valueFilters) {
    valueFilters = [];

    $(".value-filter").each((index, element) => {
      // Check the checkbox and add its ID to the value filters
      $(element).prop("checked", true);
      valueFilters.push(convertToID($(element).attr("id")));
    });

    filters.valueFilters = valueFilters;
    updateFilters(filters,FILTER_KEY);
  } else {
    // If there are value filters in session storage, set the respective checkboxes to checked
    $(".value-filter").each((index, element) => {
      valueFilters.includes(convertToID($(element).attr("id")))
        ? $(element).prop("checked", true)
        : $(element).prop("checked", false);
    });
  }

  // If there are no range sliders in session storage, initialize them with default values
  if (!rangeFilters) rangeFilters = {};

// Always iterate over all sliders in the DOM to ensure they are fully initialized.
$(".range-slider").each(function () {
  const sliderEl = this;
  const $slider = $(sliderEl);

  const category = $slider.data("col");
  const min = $slider.data("min");
  const max = $slider.data("max");

  // If a value exists in session storage, use it; otherwise, fall back to the default.
  const startValues = (rangeFilters && rangeFilters[category]) ? rangeFilters[category] : [min, max];

  // Prevent duplicate create() calls (the slider may have already been initialized in some cases).
  if (!sliderEl.noUiSlider) {
    noUiSlider
      .create(sliderEl, getSliderConfig(startValues, min, max))
      .on("change", function (values, handle) {
        const filters =
          JSON.parse(window.sessionStorage.getItem(FILTER_KEY)) || {
            rangeFilters: {},
            valueFilters: [],
            exclusiveFilters: [],
            categoryFilters: [],
          };

        if (!filters.rangeFilters) filters.rangeFilters = {};
        filters.rangeFilters[category] = values;
        updateFilters(filters, FILTER_KEY);
      });
  } else {
    // If it has already been initialized, synchronize it to the correct value
    sliderEl.noUiSlider.set(startValues);
  }

  // Ensure rangeFilters always includes all sliders present in the DOM (to avoid missing keys in later filtering).
  rangeFilters[category] = sliderEl.noUiSlider.get();
});

// Write the updated values back to filters.
filters.rangeFilters = rangeFilters;
updateFilters(filters, FILTER_KEY);

  // If there are no exclusive filters in session storage, initialize them as an empty array
  if (!exclusiveFilters) {
    exclusiveFilters = [];
    filters.exclusiveFilters = exclusiveFilters;
    $(".exclusive-filter").each((index, element) => {
      $(element).text("Exclusive filtering: OFF");
    });
    updateFilters(filters,FILTER_KEY);
  } else {
    // If there are exclusive filters in session storage, set the respective button text to "Exclusive filtering: ON" or "Exclusive filtering: OFF"
    $(".exclusive-filter").each((index, element) => {
      const category = $(element).data("col");
      if (exclusiveFilters.includes(category)) {
        $(element).text("Exclusive Filterting: ON");
      } else {
        $(element).text("Exclusive Filterting: OFF");
      }
    });
  }

  function getSliderConfig(startValues, min, max) {
    return {
      start: startValues,
      connect: true,
      range: {
        min: min,
        max: max,
      },
      tooltips: [true, true],
      format: {
        to: function (value) {
          return Math.round(value);
        },
        from: function (value) {
          return Number(value);
        },
      },
    };
  }

  function selectAll(checkboxSelection) {
    const filters = JSON.parse(window.sessionStorage.getItem(FILTER_KEY)) || { rangeFilters: {}, valueFilters: [], exclusiveFilters: [],categoryFilters: [] };
      if (!filters.rangeFilters) filters.rangeFilters = {};
    
    // Return early if filters haven't been initialized yet
    if (!filters || !filters.valueFilters || !filters.rangeFilters) {
      return;
    }

    // Check all the checkboxes in the selection
    const changedCheckboxes = [];
    checkboxSelection.find(".value-filter").each((_, element) => {
      element.checked = true;
      changedCheckboxes.push(element);
    });

    // Reset the slider to the default range by setting both handles to the minimum and maximum values
    const changedSliders = [];
    checkboxSelection.find(".range-slider").each((_, element) => {
      const min = $(element).data("min");
      const max = $(element).data("max");
      if (!element.noUiSlider) return;
      element.noUiSlider.set([min, max]);
      changedSliders.push(element);
    });

    // Add the IDs of the changed checkboxes to the value filters if they are not already included
    changedCheckboxes.forEach((element) => {
      const id = convertToID($(element).attr("id"));
      if (!filters.valueFilters.includes(id)) {
        filters.valueFilters.push(id);
      }
    });

    // Update the range filters for the changed sliders
    changedSliders.forEach((element) => {
      const category = $(element).data("col");
      const min = $(element).data("min");
      const max = $(element).data("max");
      filters.rangeFilters[category] = [min, max];
    });

    // Store the updated value filters in session storage
    updateFilters(filters,FILTER_KEY);

    // Trigger the change event only once for performance
    checkboxSelection.find(".value-filter").first().trigger("change");
  }

  function deselectAll(checkboxSelection) {
    const filters = JSON.parse(window.sessionStorage.getItem(FILTER_KEY)) || { rangeFilters: {}, valueFilters: [], exclusiveFilters: [],categoryFilters: [] };
      if (!filters.rangeFilters) filters.rangeFilters = {};
    
    // Return early if filters haven't been initialized yet
    if (!filters || !filters.valueFilters || !filters.rangeFilters) {
      return;
    }

    // Uncheck all the checkboxes in the selection
    const changedCheckboxes = [];
    checkboxSelection.find(".value-filter").each((_, element) => {
      element.checked = false;
      changedCheckboxes.push(element);
    });

    // Change the slider to no selection by setting both handles to the minimum value
    const changedSliders = [];
    checkboxSelection.find(".range-slider").each((_, element) => {
      const min = $(element).data("min");
      if (!element.noUiSlider) return;
      element.noUiSlider.set([min, min]);
      changedSliders.push(element);
    });

    // Remove the IDs of the changed checkboxes to the value filters if they are included
    changedCheckboxes.forEach((element) => {
      const id = convertToID($(element).attr("id"));
      if (filters.valueFilters.includes(id)) {
        filters.valueFilters.splice(filters.valueFilters.indexOf(id), 1);
      }
    });

    // Update the range filters for the changed sliders
    changedSliders.forEach((element) => {
      const category = $(element).data("col");
      const min = $(element).data("min");
      filters.rangeFilters[category] = [min, min];
    });

    // Store the updated value filters in session storage
    updateFilters(filters,FILTER_KEY);

    // Trigger the change event only once for performance
    checkboxSelection.find(".value-filter").first().trigger("change");
  }
    // Add event listener to each value filter to update the session storage
    $(".value-filter").on("change", function () {
      // Get the ID of the checkbox and convert it to a format suitable for storage
      const id = convertToID($(this).attr("id"));
      const filters = JSON.parse(window.sessionStorage.getItem(FILTER_KEY)) || { rangeFilters: {}, valueFilters: [], exclusiveFilters: [],categoryFilters: [] };
        if (!filters.rangeFilters) filters.rangeFilters = {};
      
      // Return early if filters haven't been initialized yet
      if (!filters || !filters.valueFilters) {
        return;
      }

      if (this.checked && !filters.valueFilters.includes(id)) {
        // Add the ID to the session storage
        filters.valueFilters.push(id);
      } else if (!this.checked && filters.valueFilters.includes(id)) {
        // Remove the ID from the session storage
        filters.valueFilters.splice(filters.valueFilters.indexOf(id), 1);
      }
      updateFilters(filters,FILTER_KEY);
    });

    $(".exclusive-filter").on("click", function () {
      const filters = JSON.parse(window.sessionStorage.getItem(FILTER_KEY)) || { rangeFilters: {}, valueFilters: [], exclusiveFilters: [],categoryFilters: [] };
      if (!filters.rangeFilters) filters.rangeFilters = {};
      const category = $(this).data("col");

      if (filters.exclusiveFilters.includes(category)) {
        // If the category is already in the exclusive filters, remove it
        filters.exclusiveFilters.splice(
          filters.exclusiveFilters.indexOf(category),
          1
        );
        $(this).text("Exclusive filterting: OFF");
      } else {
        // If the category is not in the exclusive filters, add it
        filters.exclusiveFilters.push(category);
        $(this).text("Exclusive filterting: ON");
      }
      updateFilters(filters,FILTER_KEY);
    });

  // Add "selecting / deselecting all" functionality to certain categories
  $(".select-all").on("click", function () {
    const category = $(this).data("col");

    // Find the div with the the same data-col attribute
    const categoryDiv = $(`.category[data-col="${category}"]`);

    // Select all the checkboxes within the category div
    selectAll(categoryDiv);
  });

  $(".deselect-all").on("click", function () {
    const category = $(this).data("col");

    // Find the div with the the same data-col attribute
    const categoryDiv = $(`.category[data-col="${category}"]`);

    // Deselect all the checkboxes within the category div
    deselectAll(categoryDiv);
  });

  // Add "selecting / deselecting all" functionality to certain panels
  $(".select-all-panel").on("click", function () {
    const panelValue = $(this).data("panel");

    // Find the div with the the same data-panel attribute
    const panelDiv = $(`.panel[data-panel-value="${panelValue}"]`);

    // Select all the checkboxes within the panel div
    selectAll(panelDiv);
  });

  $(".deselect-all-panel").on("click", function () {
    const panelValue = $(this).data("panel");

    // Find the div with the the same data-panel attribute
    const panelDiv = $(`.panel[data-panel-value="${panelValue}"]`);

    // Deselect all the checkboxes within the panel div
    deselectAll(panelDiv);
  });

  $(".toggle-visibility-button").on("click", function () {
    const panel = $(this).data("panel");

    // Find the div with the the same data-panel attribute
    const panelDiv = $(`.panel[data-panel-value="${panel}"]`);

    // Toggle the visibility of the filter section
    panelDiv.find(".filters").toggleClass("hidden-filters");

    // Change button text based on current state
    const isHidden = panelDiv.find(".filters").hasClass("hidden-filters");
    $(this).text(isHidden ? "Show" : "Hide");
  });

  $("#select-all-sidebar-button").on("click", function () {
    selectAll($("#sidebar"));
  });

  $("#deselect-all-sidebar-button").on("click", function () {
    deselectAll($("#sidebar"));
  });

  $("#toggle-sidebar").on("click", function () {
    $("#sidebar").toggleClass("visible-sidebar");
    $("#mask").show();
  });

  $("#close-sidebar, #mask").on("click", function () {
    $("#sidebar").toggleClass("visible-sidebar");
    $("#mask").hide();
  });

  $("#study-info-modal").on("hidden.bs.modal", function () {
    window.sessionStorage.removeItem("modalID");
  });
});
