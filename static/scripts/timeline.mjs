import {
  filterData,
  sortNodesByCategory,
  getDataEntry,
  showStudyModal,
  getFilterKey,
} from "./dataUtility.mjs";
import {
  createLegend,
  drawNode,
  highlightNode,
  removeHighlighting,
} from "./d3DrawingUtility.mjs";

const FILTER_KEY = getFilterKey();

$(document).ready(function () {
  function buildMatrixIndex(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) return null;

    const header = matrix[0];
    const colIndex = {};
    for (let c = 1; c < header.length; c++) {
      colIndex[String(header[c]).trim()] = c;
    }

    const rowIndex = {};
    for (let r = 1; r < matrix.length; r++) {
      rowIndex[String(matrix[r][0]).trim()] = r;
    }

    return { rowIndex, colIndex };
  }

  function hasEdge(matrix, index, fromId, toId) {
    if (!index) return false;

    const r = index.rowIndex[String(fromId).trim()];
    const c = index.colIndex[String(toId).trim()];

    if (r === undefined || c === undefined) return false;

    const value = matrix[r]?.[c];

    return (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== "" &&
      Number(value) !== 0
    );
  }

  function getTimelineTableColumns() {
    const mode = document.body.dataset.mode || "default";

    if (mode === "health") {
      return [
        { key: "ID", label: "ID" },
        { key: "Main Author", label: "Main Author" },
        { key: "Year", label: "Year" },
        { key: "Health Category", label: "Health Category" },
        { key: "Health Indicator", label: "Health Indicator" },
        { key: "Sensor Position", label: "Sensor Position" },
        { key: "Sensor Type", label: "Sensor Type" },
      ];
    }

    return [
      { key: "ID", label: "ID" },
      { key: "Main Author", label: "Main Author" },
      { key: "Year", label: "Year" },
      { key: "Location", label: "Location" },
      { key: "Input Body Part", label: "Input Body Part" },
      { key: "Gesture", label: "Gesture" },
    ];
  }

  function renderTableHeaders(columns, includeConnectionType = false) {
    const headerCells = columns
      .map((col) => `<th class="centered-cell">${col.label}</th>`)
      .join("");

    const extraHeader = includeConnectionType
      ? `<th class="centered-cell">Connection Type</th>`
      : `<th class="centered-cell"></th>`;

    return `
      <tr>
        <th class="centered-cell"></th>
        ${headerCells}
        ${extraHeader}
      </tr>
    `;
  }

  function renderTableRow(entry, columns, infoCirclePath, extraCellHtml = "") {
    const safeEntry = entry || {};

    const dataCells = columns
      .map((col) => `<td class="centered-cell">${safeEntry[col.key] ?? "N/A"}</td>`)
      .join("");

    return `
      <tr>
        <td class="centered-cell">
          <img
            src="${infoCirclePath}"
            alt="Info circle for this row"
            title="View details"
            data-id="${safeEntry["ID"] ?? ""}"
            class="info-circle"
          />
        </td>
        ${dataCells}
        ${extraCellHtml || `<td class="centered-cell"></td>`}
      </tr>
    `;
  }

  const coauthorMatrix = $("#timeline-graph-container").data("coauthor");
  const citationMatrix = $("#timeline-graph-container").data("citation");
  const coauthorIndex = buildMatrixIndex(coauthorMatrix);
  const citationIndex = buildMatrixIndex(citationMatrix);
  const filterCategories = $("body").data("filter-categories");
  const excludedCategories = $(".category-dropdown-container").data(
    "excluded-categories"
  );
  const infoCirclePath = $("#timelineConnectionsModal").data("info-circle-path");

  const citingOrder = { Cites: 0, "Cited By": 1, Coauthor: 2 };

  filterCategories.forEach((category) => {
    if (excludedCategories.includes(category)) return;
    const shortCategory = category.split("_").pop();
    $("#timelineColorCategory").append(
      `<option value="${category}">${shortCategory}</option>`
    );
  });

  let colorCategory = window.sessionStorage.getItem("colorCategory") || "";
  $("#timelineColorCategory").val(colorCategory);

  let showSharedAuthors =
    window.sessionStorage.getItem("showSharedAuthors") || "true";
  $("#timeline-toggle-shared-authors").prop(
    "checked",
    showSharedAuthors === "true"
  );

  let citationMode = window.sessionStorage.getItem("citationMode") || "both";
  $(`#timeline-mode-${citationMode}`).prop("checked", true);

  function formatConnectionType(value) {
    switch (value) {
      case "Cites":
        return "<span class='text-primary'>Cites</span>";
      case "Cited By":
        return "<span class='text-success'>Cited By</span>";
      default:
        return "<span class='text-secondary'>Shared Authors</span>";
    }
  }

  function showNetworkModal(id) {
    const entry = getDataEntry(id);
    const columns = getTimelineTableColumns();

    const citingLinks = d3
      .selectAll(".citing")
      .filter((d) => d.sourceID === id)
      .data();

    const citedByLinks = d3
      .selectAll(".cited-by")
      .filter((d) => d.sourceID === id)
      .data();

    const coauthorLinks = d3
      .selectAll(".coauthor")
      .filter((d) => d.sourceID === id)
      .data();

    const targetIDs = {};
    citingLinks.forEach((link) => {
      (targetIDs[link.targetID] = targetIDs[link.targetID] || []).push("Cites");
    });
    citedByLinks.forEach((link) => {
      (targetIDs[link.targetID] = targetIDs[link.targetID] || []).push("Cited By");
    });
    coauthorLinks.forEach((link) => {
      (targetIDs[link.targetID] = targetIDs[link.targetID] || []).push("Coauthor");
    });

    const orderedIDs = Object.keys(targetIDs).sort((a, b) => {
      if (targetIDs[a].length !== targetIDs[b].length) {
        return targetIDs[b].length - targetIDs[a].length;
      }
      return citingOrder[targetIDs[a][0]] - citingOrder[targetIDs[b][0]];
    });

    const headerHTML = `
      <h5 class="mb-3 text-start">Selected Study</h5>
      <div class="table-responsive">
        <table class="table table-striped">
          <thead>
            ${renderTableHeaders(columns, false)}
          </thead>
          <tbody>
            ${renderTableRow(entry, columns, infoCirclePath)}
          </tbody>
        </table>
      </div>
    `;

    let connectionsHTML;
    if (
      citingLinks.length === 0 &&
      citedByLinks.length === 0 &&
      coauthorLinks.length === 0
    ) {
      connectionsHTML =
        "<h5 class='text-start'>Study Network</h5><p>No connections found with the current filter settings.</p>";
    } else {
      connectionsHTML = `
        <h5 class="mb-3 text-start">Study Network</h5>
        <div class="table-responsive">
          <table class="table table-striped">
            <thead>
              ${renderTableHeaders(columns, true)}
            </thead>
            <tbody>
              ${orderedIDs
                .map((targetID) => {
                  const targetEntry = getDataEntry(targetID);
                  return renderTableRow(
                    targetEntry,
                    columns,
                    infoCirclePath,
                    `<td class="centered-cell">${targetIDs[targetID]
                      .map(formatConnectionType)
                      .join(", ")}</td>`
                  );
                })
                .join("\n")}
            </tbody>
          </table>
        </div>
        <p class="text-start"> Total connections: ${
          citingLinks.length + citedByLinks.length + coauthorLinks.length
        } </p>
      `;
    }

    $("#timelineConnectionsContainer").html(headerHTML);
    $("#timelineConnectionsContainer").append(connectionsHTML);
    $("#timelineConnectionsModal").modal("show");
  }

  function generateTimelineData() {
    const activeNodes = filterData(
      JSON.parse(window.sessionStorage.getItem(FILTER_KEY))
    ).map((item) => item["ID"].toString());

    const { sortedNodes, colorScale } = sortNodesByCategory(
      activeNodes,
      colorCategory
    );

    const nodes = sortedNodes.map((node) => {
      return {
        id: node,
        year: getDataEntry(node, "Year"),
      };
    });

    const years = {};
    nodes.forEach((node) => {
      if (!years[node.year]) {
        years[node.year] = [node.id];
      } else {
        years[node.year].push(node.id);
      }
    });

    const maxYears = Math.max(
      ...Object.keys(years).map((year) => years[year].length)
    );

    const links = { coauthorLinks: [], citingLinks: [], citedByLinks: [] };
    for (const node of sortedNodes) {
      for (const other of sortedNodes) {
        if (node === other) continue;

        if (hasEdge(coauthorMatrix, coauthorIndex, node, other)) {
          links.coauthorLinks.push({
            sourceID: node,
            targetID: other,
          });
        }

        if (hasEdge(citationMatrix, citationIndex, node, other)) {
          links.citingLinks.push({
            sourceID: node,
            targetID: other,
          });
        }

        if (hasEdge(citationMatrix, citationIndex, other, node)) {
          links.citedByLinks.push({
            sourceID: node,
            targetID: other,
          });
        }
      }
    }

    return {
      nodes,
      years,
      links,
      maxYears,
      colorScale,
    };
  }

  function drawTimelineGraph() {
    const headerHeight = $("header").outerHeight(true) || 0;
    const timelineControlsHeight = $(".timeline-controls").outerHeight(true) || 0;
    const visualizationWarningHeight =
      window.innerWidth <= 750
        ? $("#visualization-warning").outerHeight(true) || 0
        : 0;

    $("#timeline-graph-container").empty();
    $("#timeline-graph-container").height(
      `min(1000px, calc(90vh - ${
        headerHeight + timelineControlsHeight + visualizationWarningHeight
      }px))`
    );
    $("#legend").empty();

    const { nodes, years, links, maxYears, colorScale } = generateTimelineData();
    const { coauthorLinks, citingLinks, citedByLinks } = links;

    if (nodes.length === 0) {
      $("#timeline-graph-container").append(
        "<p class='m-2 p-0'>No studies available for the selected sidebar filters. Please select some of the criteria from the sidebar at the right.</p>"
      );
      return;
    }

    let margin =
      window.innerWidth <= 750
        ? { top: 5, right: 20, bottom: 30, left: 20 }
        : { top: 20, right: 50, bottom: 20, left: 50 };
    const containerWidth = $("#timeline-graph-container").width();
    const innerWidth = containerWidth - margin.left - margin.right;

    const nodeRadius = Math.min(12, innerWidth / 100);

    const height = $("#timeline-graph-container").height();
    const innerHeight = height - margin.top - margin.bottom;
    const axisHeight = innerHeight;

    const responsiveFontSize = getComputedStyle(document.body)
      .getPropertyValue("--resp-font-ticks-bg")
      .trim();

    const svg = d3
      .select("#timeline-graph-container")
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", height)
      .attr("viewBox", `${margin.left} ${margin.top} ${innerWidth} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const xScale = d3
      .scalePoint()
      .domain(Object.keys(years).map(Number))
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, maxYears])
      .range([axisHeight - margin.bottom, 0]);

    const g = svg
      .append("g")
      .attr("transform", `translate (${margin.left}, ${margin.top})`);

    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat(d3.format("d"))
      .tickSize(window.innerWidth <= 750 ? 0 : 5);

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${axisHeight})`)
      .call(xAxis)
      .call((g) => {
        if (window.innerWidth <= 750) {
          g.select(".domain").attr("stroke", "#000");
          g.selectAll(".tick").remove();

          const yearValues = Object.keys(years)
            .map(Number)
            .sort((a, b) => a - b);

          g.selectAll(".custom-tick")
            .data(yearValues)
            .join("g")
            .attr("class", "custom-tick")
            .attr("transform", (d) => `translate(${xScale(d)}, 0)`)
            .each(function (d, i) {
              const isAbove = i % 2 === 0;
              const tick = d3.select(this);

              const tickSize = 5;
              const textOffset = 8;

              tick
                .append("line")
                .attr("class", "tick-line")
                .attr("y1", 1)
                .attr("y2", isAbove ? -tickSize : tickSize);

              tick
                .append("text")
                .attr("class", "tick-text")
                .attr("text-anchor", "middle")
                .attr("dy", isAbove ? -textOffset : textOffset + tickSize)
                .style("font-size", responsiveFontSize)
                .style("user-select", "none")
                .text(d);
            });
        }
      });

    const linkGroup = g.append("g").attr("class", "links");
    const nodeGroup = g.append("g").attr("class", "nodes");

    const arc = d3.arc().innerRadius(0).outerRadius(nodeRadius);

    nodeGroup
      .selectAll(".node")
      .data(nodes.map((node) => node.id))
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => {
        const year = nodes.find((node) => node.id === d).year;
        return `translate(${xScale(year)}, ${yScale(years[year].indexOf(d))})`;
      })
      .each(function (d) {
        drawNode(d3.select(this), colorCategory, arc, colorScale);
      })
      .on("click", function (event, d) {
        showNetworkModal(d);
      })
      .on("mouseover", function (event, d) {
        nodeTooltip.style("visibility", "visible");
        nodeTooltip.style("left", `${event.pageX + 15}px`);
        nodeTooltip.style("top", `${event.pageY}px`);

        const entry = getDataEntry(d);
        nodeTooltip.html(`
          <strong>Study ${entry["ID"]}</strong>
          <p>${entry["Main Author"]} (${entry["Year"]})</p>
          <p>Location: ${entry["Location"]}</p>
        `);

        highlightNode(
          d,
          nodeRadius,
          citationMode === "cited-by" || citationMode === "cites"
        );
      })
      .on("mouseout", function () {
        nodeTooltip.style("visibility", "hidden");
        removeHighlighting(nodeRadius);
      });

    const nodeTooltip = d3
      .select("#timeline-graph-container")
      .append("div")
      .attr("class", "node-tooltip")
      .style("visibility", "hidden");

    if (showSharedAuthors === "true") {
      linkGroup
        .selectAll(".link .coauthor")
        .data(coauthorLinks)
        .join("path")
        .attr("class", "coauthor link")
        .attr("d", (d) => drawLink(d));
    }

    if (citationMode === "both" || citationMode === "cites") {
      linkGroup
        .selectAll(".link .citing")
        .data(citingLinks)
        .join("path")
        .attr("class", "citing link")
        .attr("d", (d) => drawLink(d));
    }

    if (citationMode === "both" || citationMode === "cited-by") {
      linkGroup
        .selectAll(".link .cited-by")
        .data(citedByLinks)
        .join("path")
        .attr("class", "cited-by link")
        .attr("d", (d) => drawLink(d));
    }

    function drawLink(d) {
      const sourceNode = nodes.find((node) => node.id === d.sourceID);
      const targetNode = nodes.find((node) => node.id === d.targetID);
      const sourceX = xScale(sourceNode.year);
      const targetX = xScale(targetNode.year);
      const sourceY = yScale(years[sourceNode.year].indexOf(sourceNode.id));
      const targetY = yScale(years[targetNode.year].indexOf(targetNode.id));

      if (sourceX === targetX) {
        const midY = (sourceY + targetY) / 2;
        return `M ${sourceX},${sourceY} Q ${Math.min(
          sourceX + xScale.step(),
          $("#timeline-graph-container").width() - margin.right / 2
        )},${midY} ${targetX},${targetY}`;
      } else {
        const dx = targetX - sourceX;
        const controlOffset = Math.min(Math.abs(dx) * 0.4, 100);

        const controlX1 = sourceX + Math.sign(dx) * controlOffset;
        const controlY1 = sourceY - 40;
        const controlX2 = targetX - Math.sign(dx) * controlOffset;
        const controlY2 = targetY - 40;

        return `M ${sourceX},${sourceY} C ${controlX1},${controlY1} ${controlX2},${controlY2} ${targetX},${targetY}`;
      }
    }

    linkGroup
      .selectAll(".citing")
      .append("title")
      .text((d) => `[${d.sourceID}] cites [${d.targetID}]`);

    linkGroup
      .selectAll(".cited-by")
      .append("title")
      .text((d) => `[${d.sourceID}] is cited by [${d.targetID}]`);

    linkGroup
      .selectAll(".coauthor")
      .append("title")
      .text((d) => `[${d.sourceID}] shares authors with [${d.targetID}]`);

    createLegend(
      nodes.map((node) => node.id),
      colorScale,
      colorCategory,
      $("#legend")
    );
  }

  drawTimelineGraph();

  $("#timeline-toggle-shared-authors").on("click", function () {
    showSharedAuthors = $(this).is(":checked").toString();
    window.sessionStorage.setItem("showSharedAuthors", showSharedAuthors);
    drawTimelineGraph();
  });

  $("input[name='citation-mode']").on("click", function () {
    citationMode = $(this).val();
    window.sessionStorage.setItem("citationMode", citationMode);
    drawTimelineGraph();
  });

  $("#timelineColorCategory").on("change", function () {
    colorCategory = $(this).val();
    window.sessionStorage.setItem("colorCategory", colorCategory);
    drawTimelineGraph();
  });

  window.addEventListener("resize", function () {
    drawTimelineGraph();
  });

  $(".value-filter").on("change", function () {
    drawTimelineGraph();
  });

  $(".exclusive-filter").on("click", function () {
    drawTimelineGraph();
  });

  $(".range-slider").each(function () {
    this.noUiSlider.on("end", function () {
      drawTimelineGraph();
    });
  });

  $("#timelineConnectionsContainer").on("click", ".info-circle", function () {
    const id = $(this).data("id");
    $("#timelineConnectionsModal").modal("hide");
    showStudyModal(id);
  });
});