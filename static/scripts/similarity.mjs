import {
  filterData,
  getDataEntry,
  showStudyModal,
  sortNodesByCategory,
  getFilterKey,
} from "./dataUtility.mjs";
import {
  createLegend,
  highlightNode,
  removeHighlighting,
  drawNode,
} from "./d3DrawingUtility.mjs";

const FILTER_KEY = getFilterKey();

/*
Interaction section
Here the event listeners for the interaction possibilities of the similarity graph are set up
*/
$(document).ready(function () {
  const similarityData = $("#graphContainer").data("similarity");
  const filterCategories = $("body").data("filter-categories");
  const excluded_categories = $("#categoryDropdownContainer").data(
    "excluded-categories"
  );
  const infoCirclePath = $("#graphContainer").data("info-circle-path");

  const abstractTooltip =
    "This visualization shows semantic similarity between paper abstracts. Similarities were calculated using Google Gemini embeddings (gemini-embedding-exp-03-07) with cosine similarity and then z-standardized. Values above 0 indicate above-average similarity (0=mean, 1=one standard deviation above mean). Higher thresholds show only the most similar papers.";
  const databaseTooltip =
    "This visualization shows similarity between studies based on features extracted from the database. Features were normalized and similarity was calculated based on their values.";

  const abstractStudyIDs = similarityData["abstract_study_ids"];
  const abstractMatrix = similarityData["abstract_matrix"];
  const databaseStudyIDs = similarityData["database_study_ids"];
  const databaseMatrix = similarityData["database_matrix"];

  function getSimilarityTableColumns() {
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

  function renderTableHeaders(columns, lastHeaderLabel = "") {
    const headerCells = columns
      .map((col) => `<th>${col.label}</th>`)
      .join("");

    return `
      <tr>
        <th></th>
        ${headerCells}
        <th>${lastHeaderLabel}</th>
      </tr>
    `;
  }

  function renderTableRow(entry, columns, infoCirclePath, extraCellHtml = "") {
    const safeEntry = entry || {};

    const dataCells = columns
      .map((col) => `<td>${safeEntry[col.key] ?? "N/A"}</td>`)
      .join("");

    return `
      <tr>
        <td>
          <img
            src="${infoCirclePath}"
            alt="Info circle for this row"
            title="Information about this row"
            data-id="${safeEntry["ID"] ?? ""}"
            class="info-circle network-information"
          />
        </td>
        ${dataCells}
        ${extraCellHtml || `<td></td>`}
      </tr>
    `;
  }

  let similarityType =
    window.sessionStorage.getItem("similarityType") || "database";
  $(`input[value='${similarityType}']`).prop("checked", true);

  $("#thresholdInfoIcon").attr(
    "title",
    similarityType === "abstract" ? abstractTooltip : databaseTooltip
  );

  filterCategories.forEach((category) => {
    if (excluded_categories.includes(category)) return;
    const shortCategory = category.split("_").pop();
    $("#similarityColorCategory").append(
      `<option value="${category}">${shortCategory}</option>`
    );
  });

  let colorCategory = window.sessionStorage.getItem("colorCategory") || "";
  $(`#similarityColorCategory > option[value="${colorCategory}"]`).prop(
    "selected",
    true
  );

  let similarityThreshold =
    parseFloat(window.sessionStorage.getItem("similarityThreshold")) || 1;
  $("#thresholdValue").text(similarityThreshold.toFixed(2));

  const slider = document.getElementById("thresholdSlider");
  noUiSlider
    .create(slider, {
      start: [similarityThreshold],
      connect: [true, false],
      range: {
        min: -3,
        max: 3,
      },
      step: 0.1,
      tooltips: [true],
      format: {
        to: function (value) {
          return value.toFixed(2);
        },
        from: function (value) {
          return parseFloat(value);
        },
      },
    })
    .on("change", function (values, handle) {
      similarityThreshold = parseFloat(values[handle]);
      $("#thresholdValue").text(similarityThreshold.toFixed(2));
      drawGraph(similarityThreshold);
      window.sessionStorage.setItem("similarityThreshold", similarityThreshold);
    });

  function openNetworkDetails(nodeID, links) {
    const nodeData = getDataEntry(nodeID);
    const columns = getSimilarityTableColumns();

    const connectedNodes = links
      .filter((link) => link.sourceID === nodeID || link.targetID === nodeID)
      .map((link) => {
        return {
          id: link.sourceID === nodeID ? link.targetID : link.sourceID,
          similarity: link.value,
        };
      });

    connectedNodes.sort((a, b) => b.similarity - a.similarity);

    const sourceHTML = `
      <h5 class="mb-3">Selected Study</h5>
      <div class="table-responsive mb-4">
        <table class="table table-striped">
          <thead>
            ${renderTableHeaders(columns, "")}
          </thead>
          <tbody>
            ${renderTableRow(nodeData, columns, infoCirclePath, "<td></td>")}
          </tbody>
        </table>
      </div>
    `;

    const connectionsHTML = `
      <h5 class="mb-3">Study Network</h5>
      <div class="table-responsive">
        <table class="table table-striped">
          <thead>
            ${renderTableHeaders(columns, "Similarity")}
          </thead>
          <tbody>
            ${
              connectedNodes.length > 0
                ? connectedNodes
                    .map((node) => {
                      const connectedNodeData = getDataEntry(node.id);
                      return renderTableRow(
                        connectedNodeData,
                        columns,
                        infoCirclePath,
                        `<td><strong>${node.similarity.toFixed(2)}</strong></td>`
                      );
                    })
                    .join("")
                : `<tr><td colspan="${
                    columns.length + 2
                  }" class="text-center">No connected studies found.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;

    const totalConnectionsHTML = `<p class="text-muted mt-2">Total connections: ${connectedNodes.length}</p>`;

    $("#connectionsContainer").empty();
    $("#connectionsContainer").html(sourceHTML);
    $("#connectionsContainer").append(connectionsHTML);
    $("#connectionsContainer").append(totalConnectionsHTML);

    $("#connectionsModal").modal("show");
  }

  function findSimilarStudies(links) {
    const modalID = window.sessionStorage.getItem("modalID");
    if (modalID) {
      openNetworkDetails(modalID, links);
    }
  }

  function generateGraphData(threshold) {
    const { studyIDs, similarityMatrix } = getCurrentSimilarityData();
    const links = [];

    const idToIndex = {};
    for (let k = 0; k < studyIDs.length; k++) {
      idToIndex[String(studyIDs[k]).trim()] = k;
    }

    const { sortedNodes, colorScale } = sortNodesByCategory(
      studyIDs,
      $("#similarityColorCategory").val()
    );

    for (let i = 0; i < sortedNodes.length; i++) {
      for (let j = i + 1; j < sortedNodes.length; j++) {
        const nodeA = String(sortedNodes[i]).trim();
        const nodeB = String(sortedNodes[j]).trim();

        const idxA = idToIndex[nodeA];
        const idxB = idToIndex[nodeB];

        if (idxA === undefined || idxB === undefined) continue;

        const similarity = similarityMatrix[idxA]?.[idxB];

        if (similarity && similarity >= threshold) {
          links.push({
            sourceID: nodeA,
            targetID: nodeB,
            value: similarity,
          });
        }
      }
    }

    return { sortedNodes, links, colorScale };
  }

  function getCurrentSimilarityData() {
    const filters = JSON.parse(window.sessionStorage.getItem(FILTER_KEY));
    const activeDataIDs = filterData(filters).map((item) =>
      item["ID"].toString()
    );

    if (similarityType === "abstract") {
      return {
        studyIDs: abstractStudyIDs.filter((id) => activeDataIDs.includes(id)),
        similarityMatrix: abstractMatrix,
      };
    } else if (similarityType === "database") {
      return {
        studyIDs: databaseStudyIDs.filter((id) => activeDataIDs.includes(id)),
        similarityMatrix: databaseMatrix,
      };
    }
  }

  function formatTickLabel(d) {
    const author = getDataEntry(d, "Main Author");
    return `${author} [${d}]`;
  }

  function drawGraph(threshold) {
    $("#graphContainer").empty();
    $("#legend").empty();

    const { sortedNodes, links, colorScale } = generateGraphData(threshold);
    const nodes = [...sortedNodes];

    if (nodes.length === 0) {
      $("#graphContainer").append(
        "<p class='text-center m-2 p-0'>No studies available for the selected sidebar filters. Please select some of the criteria from the sidebar at the right.</p>"
      );
      return;
    }

    const useULayout = nodes.length > 50;
    const alignVertically = window.innerWidth <= 850;

    const margin = alignVertically
      ? { top: 10, right: 5, bottom: 10, left: 5 }
      : { top: 10, right: 20, bottom: 10, left: 20 };

    const containerWidth = $("#graphContainer").width();
    const headerHeight = $("header").outerHeight(true) || 0;
    const controlsHeight = $(".controls").outerHeight(true) || 0;
    const visualizationWarningHeight =
      window.innerWidth <= 850
        ? $("#visualization-warning").outerHeight(true) || 0
        : 0;

    $("#graphContainer").height(
      alignVertically
        ? "120vh"
        : `min(1000px, calc(90vh - ${
            headerHeight + controlsHeight + visualizationWarningHeight
          }px))`
    );

    const svg = d3
      .select("#graphContainer")
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");

    const viewBoxX = alignVertically ? 0 : containerWidth * 0.2;
    const viewBoxY = alignVertically ? 0 : -$("#graphContainer").height() * 0.2;
    const viewBoxWidth = containerWidth;
    const viewBoxHeight = alignVertically
      ? $("#graphContainer").height()
      : $("#graphContainer").height() * 1.4;

    if (useULayout) {
      svg.attr("viewBox", `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
    }

    const layoutFunction = useULayout ? drawULayout : drawStandardLayout;
    layoutFunction(svg, margin, { nodes, links }, colorScale, !alignVertically);

    createLegend(
      nodes,
      colorScale,
      $("#similarityColorCategory").val(),
      $("#legend")
    );

    findSimilarStudies(links);
  }

  function drawULayout(
    container,
    margin,
    graphData,
    colorScale,
    alignHorizontal
  ) {
    const { nodes, links } = graphData;

    const height = parseInt($("svg").height()) - margin.top - margin.bottom;
    const width = alignHorizontal
      ? parseInt($("svg").width()) * 1.4 - margin.left - margin.right
      : parseInt($("svg").width()) - margin.left - margin.right;
    const firstAxisPos = alignHorizontal ? height / 4 : width / 3;
    const axisMiddle = alignHorizontal ? height / 2 : width / 2;

    const nodeRadius = alignHorizontal ? Math.min(10, width / 150) : 6;

    const firstNodes = nodes.filter(
      (node) => nodes.indexOf(node) <= nodes.length / 2
    );
    const secondNodes = nodes.filter(
      (node) => nodes.indexOf(node) > nodes.length / 2
    );

    const responsiveFontSize = getComputedStyle(document.body)
      .getPropertyValue("--resp-font-ticks")
      .trim();

    const firstScale = d3
      .scalePoint()
      .domain(firstNodes)
      .rangeRound([0, alignHorizontal ? width : height]);

    const secondScale = d3
      .scalePoint()
      .domain(secondNodes)
      .rangeRound([0, alignHorizontal ? width : height]);

    const arc = d3.arc().innerRadius(0).outerRadius(nodeRadius);

    const firstAxis = alignHorizontal
      ? d3
          .axisTop(firstScale)
          .tickValues(firstNodes)
          .tickFormat(() => "")
          .tickSize(0)
          .tickPadding(-4)
      : d3
          .axisLeft(firstScale)
          .tickValues(firstNodes)
          .tickFormat(() => "")
          .tickSize(0)
          .tickPadding(8);

    const secondAxis = alignHorizontal
      ? d3
          .axisBottom(secondScale)
          .tickValues(secondNodes)
          .tickFormat(() => "")
          .tickSize(0)
          .tickPadding(-4)
      : d3
          .axisRight(secondScale)
          .tickValues(secondNodes)
          .tickFormat(() => "")
          .tickSize(0)
          .tickPadding(8);

    const g = container
      .append("g")
      .attr("transform", `translate (${margin.left}, ${margin.top})`);

    g.append("g")
      .attr(
        "transform",
        alignHorizontal
          ? `translate(0, ${firstAxisPos})`
          : `translate(${firstAxisPos}, 0)`
      )
      .attr("class", "top-axis")
      .call(firstAxis);

    g.append("g")
      .attr(
        "transform",
        alignHorizontal
          ? `translate(0, ${3 * firstAxisPos})`
          : `translate(${2 * firstAxisPos}, 0)`
      )
      .attr("class", "bottom-axis")
      .call(secondAxis);

    container.selectAll(".top-axis text").html((d) => {
      const label = formatTickLabel(d);
      const infoCircle = '<tspan class="info-circle">ⓘ </tspan>';
      const labelSpan = `<tspan>${label}</tspan>`;

      return alignHorizontal
        ? `${labelSpan} ${infoCircle}`
        : `${infoCircle} ${labelSpan}`;
    });

    container.selectAll(".bottom-axis text").html((d) => {
      const label = formatTickLabel(d);
      const infoCircle = '<tspan class="info-circle">ⓘ </tspan>';
      const labelSpan = `<tspan>${label}</tspan>`;

      return alignHorizontal
        ? `${infoCircle} ${labelSpan}`
        : `${labelSpan} ${infoCircle}`;
    });

    if (alignHorizontal) {
      container
        .select(".top-axis")
        .selectAll("text")
        .attr("text-anchor", "start")
        .attr("transform", "rotate(-90)")
        .attr("dx", "2em");
    }

    if (alignHorizontal) {
      container
        .select(".bottom-axis")
        .selectAll("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("dx", "-2em");
    }

    d3.selectAll(".tick")
      .on("click", function (event, d) {
        showStudyModal(d);
      })
      .style("cursor", "pointer")
      .style("font-size", responsiveFontSize)
      .style("user-select", "none");

    const linkGroup = g.append("g").attr("class", "links");
    const nodeGroup = g.append("g").attr("class", "nodes");

    nodeGroup
      .selectAll(".node")
      .data(firstNodes, (d) => d)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) =>
        alignHorizontal
          ? `translate(${firstScale(d)}, ${firstAxisPos})`
          : `translate(${firstAxisPos}, ${firstScale(d)})`
      )
      .each(function (d) {
        drawNode(d3.select(this), colorCategory, arc, colorScale);
      })
      .on("click", function (event, d) {
        openNetworkDetails(d, links);
      })
      .on("mouseover", function (event, d) {
        highlightNode(d, nodeRadius);
      })
      .on("mouseout", () => removeHighlighting(nodeRadius));

    nodeGroup
      .selectAll(".node")
      .data(secondNodes, (d) => d)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) =>
        alignHorizontal
          ? `translate(${secondScale(d)}, ${3 * firstAxisPos})`
          : `translate(${2 * firstAxisPos}, ${secondScale(d)})`
      )
      .each(function (d) {
        drawNode(d3.select(this), colorCategory, arc, colorScale);
      })
      .on("click", function (event, d) {
        openNetworkDetails(d, links);
      })
      .on("mouseover", function (event, d) {
        highlightNode(d, nodeRadius);
      })
      .on("mouseout", () => removeHighlighting(nodeRadius));

    linkGroup
      .selectAll(".link")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", (d) => {
        const isSourceFirst = firstNodes.includes(d.sourceID);
        const isTargetFirst = firstNodes.includes(d.targetID);

        const sourceScale = isSourceFirst ? firstScale : secondScale;
        const targetScale = isTargetFirst ? firstScale : secondScale;

        const sourceX = alignHorizontal
          ? sourceScale(d.sourceID)
          : isSourceFirst
          ? firstAxisPos
          : 2 * firstAxisPos;
        const targetX = alignHorizontal
          ? targetScale(d.targetID)
          : isTargetFirst
          ? firstAxisPos
          : 2 * firstAxisPos;
        const sourceY = alignHorizontal
          ? isSourceFirst
            ? firstAxisPos
            : 3 * firstAxisPos
          : sourceScale(d.sourceID);
        const targetY = alignHorizontal
          ? isTargetFirst
            ? firstAxisPos
            : 3 * firstAxisPos
          : targetScale(d.targetID);

        if (alignHorizontal) {
          if (sourceY === targetY) {
            const midPointY =
              axisMiddle + (isSourceFirst ? margin.top : -margin.top) * 15;
            return `M ${sourceX} ${sourceY} Q ${
              (sourceX + targetX) / 2
            } ${midPointY}, ${targetX} ${targetY}`;
          }
          return `M ${sourceX} ${sourceY} C ${sourceX} ${axisMiddle}, ${targetX} ${axisMiddle}, ${targetX} ${targetY}`;
        } else {
          if (sourceX === targetX) {
            const midPointX =
              axisMiddle + (isSourceFirst ? margin.left : -margin.right) * 20;
            return `M ${sourceX} ${sourceY} Q ${midPointX} ${
              (sourceY + targetY) / 2
            }, ${targetX} ${targetY}`;
          }
          return `M ${sourceX} ${sourceY} C ${axisMiddle} ${sourceY}, ${axisMiddle} ${targetY}, ${targetX} ${targetY}`;
        }
      });

    linkGroup
      .selectAll(".link")
      .append("title")
      .text(
        (d) =>
          `${
            similarityType === "database" ? "Database" : "Abstract"
          } Similarity: ${d.value.toFixed(2)} between [${d.sourceID}] and [${
            d.targetID
          }]`
      );
  }

  function drawStandardLayout(
    container,
    margin,
    graphData,
    colorScale,
    alignHorizontal
  ) {
    const { nodes, links } = graphData;

    const height = parseInt($("svg").height()) - margin.top - margin.bottom;
    const width = parseInt($("svg").width()) - margin.left - margin.right;
    const axisMiddle = alignHorizontal ? height / 2 : width / 2;

    const nodeRadius = alignHorizontal ? Math.min(10, width / 150) : 6;

    const nodeScale = d3
      .scalePoint()
      .domain(nodes)
      .rangeRound([0, alignHorizontal ? width : height]);

    const axis = alignHorizontal
      ? d3
          .axisBottom(nodeScale)
          .tickValues(nodes)
          .tickFormat(() => "")
          .tickSize(0)
          .tickPadding(-4)
      : d3
          .axisLeft(nodeScale)
          .tickFormat(() => "")
          .tickSize(0)
          .tickPadding(8);

    const responsiveFontSize = getComputedStyle(document.body)
      .getPropertyValue("--resp-font-ticks")
      .trim();

    const g = container
      .append("g")
      .attr("transform", `translate (${margin.left}, ${margin.top})`);

    g.append("g")
      .attr("class", "axis")
      .attr(
        "transform",
        alignHorizontal
          ? `translate(0, ${axisMiddle})`
          : `translate(${axisMiddle}, 0)`
      )
      .call(axis);

    d3.selectAll("text").html(
      (d) =>
        `<tspan class="info-circle">ⓘ </tspan><tspan>${formatTickLabel(
          d
        )}</tspan>`
    );

    if (alignHorizontal) {
      d3.selectAll("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("dx", "-2em")
        .style("font-size", responsiveFontSize)
        .style("user-select", "none");
    }

    d3.selectAll(".tick")
      .on("click", function (event, d) {
        showStudyModal(d);
      })
      .style("cursor", "pointer");

    const linkGroup = g.append("g").attr("class", "links");

    const nodeGroup = g
      .append("g")
      .attr(
        "transform",
        alignHorizontal
          ? `translate(0, ${axisMiddle})`
          : `translate(${axisMiddle}, 0)`
      )
      .attr("class", "nodes");

    const arc = d3.arc().innerRadius(0).outerRadius(nodeRadius);

    nodeGroup
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) =>
        alignHorizontal
          ? `translate(${nodeScale(d)}, 0)`
          : `translate(0, ${nodeScale(d)})`
      )
      .each(function (d) {
        drawNode(d3.select(this), colorCategory, arc, colorScale);
      })
      .on("click", function (event, d) {
        openNetworkDetails(d, links);
      })
      .on("mouseover", function (event, d) {
        highlightNode(d, nodeRadius);
      })
      .on("mouseout", () => removeHighlighting(nodeRadius));

    linkGroup
      .selectAll(".link")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", (d) => {
        if (alignHorizontal) {
          const sourceX = nodeScale(d.sourceID);
          const targetX = nodeScale(d.targetID);
          const midX = (sourceX + targetX) / 2;
          const arcHeight = Math.min(
            Math.abs(sourceX - targetX) * 0.4,
            height / 3
          );

          return `M ${sourceX} ${axisMiddle} Q ${midX} ${
            axisMiddle - arcHeight
          }, ${targetX} ${axisMiddle}`;
        } else {
          const sourceY = nodeScale(d.sourceID);
          const targetY = nodeScale(d.targetID);
          const midY = (sourceY + targetY) / 2;
          const arcWidth = Math.min(Math.abs(sourceY - targetY) * 2, width / 2);

          return `M ${axisMiddle} ${sourceY} Q ${
            axisMiddle + arcWidth
          } ${midY}, ${axisMiddle} ${targetY}`;
        }
      });

    linkGroup
      .selectAll(".link")
      .append("title")
      .text(
        (d) =>
          `${
            similarityType === "database" ? "Database" : "Abstract"
          } Similarity: ${d.value.toFixed(2)} between [${d.sourceID}] and [${
            d.targetID
          }]`
      );
  }

  drawGraph(similarityThreshold);

  $("input[name='similarityType']").on("change", function () {
    similarityType = $(this).val();
    window.sessionStorage.setItem("similarityType", similarityType);

    $("#thresholdInfoIcon").attr(
      "title",
      similarityType === "abstract" ? abstractTooltip : databaseTooltip
    );
    drawGraph(similarityThreshold);
  });

  $("#similarityColorCategory").on("change", function () {
    colorCategory = $(this).val();
    window.sessionStorage.setItem("colorCategory", colorCategory);
    drawGraph(similarityThreshold);
  });

  window.addEventListener("resize", function () {
    drawGraph(similarityThreshold);
  });

  $(".value-filter").on("change", function () {
    drawGraph(similarityThreshold);
  });

  $(".exclusive-filter").on("click", function () {
    drawGraph(similarityThreshold);
  });

  $("#connectionsContainer").on("click", ".info-circle", function () {
    const id = $(this).data("id");

    if (this.classList.contains("network-information")) {
      $("#connectionsModal").modal("hide");
    }

    showStudyModal(id);
  });

  $(".range-slider").each(function () {
    this.noUiSlider.on("end", function () {
      drawGraph(similarityThreshold);
    });
  });

  $("#connectionsModal").on("hidden.bs.modal", function () {
    window.sessionStorage.removeItem("modalID");
  });
});