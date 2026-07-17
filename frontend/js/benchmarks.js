const statusEl = document.getElementById("status");
const categoryTabs = document.getElementById("category-tabs");
const sortingControls = document.getElementById("sorting-controls");
const pathfindingControls = document.getElementById("pathfinding-controls");
const runBtn = document.getElementById("run-btn");
const runBtnLabel = document.getElementById("run-btn-label");
const arrayTypeSelect = document.getElementById("array-type-select");
const pfDensitySelect = document.getElementById("pf-density-select");
const progressWrap = document.getElementById("bench-progress");
const progressFill = document.getElementById("bench-progress-fill");
const progressText = document.getElementById("bench-progress-text");
const chartPanel = document.getElementById("chart-panel");
const chartTabs = document.getElementById("chart-tabs");
const tabComparisons = document.getElementById("tab-comparisons");
const chartContainer = document.getElementById("chart-container");
const chartLegend = document.getElementById("chart-legend");
const resultsCard = document.getElementById("results-table-card");
const resultsThead = document.getElementById("results-thead");
const resultsTbody = document.getElementById("results-tbody");
const exportBtn = document.querySelector(".export-btn");

const SORTING_NAMES = {
  bubble: "Bubble", selection: "Selection", insertion: "Insertion",
  merge: "Merge", quick: "Quick", heap: "Heap"
};
const PATHFINDING_NAMES = {
  bfs: "BFS", dfs: "DFS", dijkstra: "Dijkstra", astar: "A*", greedy: "Greedy"
};
const SORTING_COLORS = {
  bubble: "#D85A30", selection: "#D4537E", insertion: "#7F77DD",
  merge: "#534AB7", quick: "#1D9E75", heap: "#EF9F27"
};
const PATHFINDING_COLORS = {
  bfs: "#D85A30", dfs: "#D4537E", dijkstra: "#534AB7", astar: "#1D9E75", greedy: "#EF9F27"
};

let currentCategory = "sorting";
let resultsByAlgorithm = {};
let currentMetric = "execution_time_ms";

function names() { return currentCategory === "sorting" ? SORTING_NAMES : PATHFINDING_NAMES; }
function colors() { return currentCategory === "sorting" ? SORTING_COLORS : PATHFINDING_COLORS; }

pingBackend()
  .then((data) => {
    statusEl.textContent = `Connected: ${data.message}`;
    statusEl.classList.add("ok");
  })
  .catch((err) => {
    statusEl.textContent = "Backend offline";
    statusEl.classList.add("error");
    console.error(err);
  });

categoryTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;

  currentCategory = btn.dataset.category;
  categoryTabs.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");

  const isSorting = currentCategory === "sorting";
  sortingControls.style.display = isSorting ? "block" : "none";
  pathfindingControls.style.display = isSorting ? "none" : "block";
  tabComparisons.style.display = isSorting ? "inline-block" : "none";
  tabComparisons.dataset.metric = isSorting ? "comparisons" : "visited_count";
  tabComparisons.textContent = isSorting ? "Comparisons" : "Visited nodes";

  resultsByAlgorithm = {};
  chartPanel.style.display = "none";
  resultsCard.style.display = "none";

  chartTabs.querySelectorAll(".chart-tab").forEach(b => b.classList.remove("active"));
  chartTabs.querySelector('[data-metric="execution_time_ms"]').classList.add("active");
  currentMetric = "execution_time_ms";
});

function getChecked(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(cb => cb.value);
}

function buildLineChart(seriesByAlgo, metric) {
  const width = 900, height = 320, padL = 55, padR = 20, padT = 20, padB = 40;
  const innerW = width - padL - padR, innerH = height - padT - padB;

  const allPoints = Object.values(seriesByAlgo).flat();
  if (allPoints.length === 0) return "<p style='color:#888780;font-size:12px;'>No data yet.</p>";

  const sizes = [...new Set(allPoints.map(p => p.size))].sort((a, b) => a - b);
  const maxVal = Math.max(...allPoints.map(p => p[metric] ?? 0), 1);
  const minSize = sizes[0], maxSize = sizes[sizes.length - 1];

  const xFor = (size) => padL + (maxSize === minSize ? 0 : (size - minSize) / (maxSize - minSize)) * innerW;
  const yFor = (val) => padT + innerH - ((val ?? 0) / maxVal) * innerH;

  let svg = `<svg 
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">`;

  const gridCount = 5;
  for (let i = 0; i <= gridCount; i++) {
    const val = (maxVal / gridCount) * i;
    const y = yFor(val);
    svg += `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#f0efe9" stroke-width="1"/>`;
    svg += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#b4b2a9">${Math.round(val * 100) / 100}</text>`;
  }

  sizes.forEach((size) => {
    const x = xFor(size);
    svg += `<text x="${x}" y="${height - padB + 16}" text-anchor="middle" font-size="10" fill="#b4b2a9">${size}</text>`;
  });

  Object.entries(seriesByAlgo).forEach(([algo, points]) => {
    const sorted = [...points].sort((a, b) => a.size - b.size);
    const color = colors()[algo];
    const linePoints = sorted.map(p => `${xFor(p.size)},${yFor(p[metric])}`).join(" ");
    svg += `<polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    sorted.forEach(p => {
      svg += `<circle cx="${xFor(p.size)}" cy="${yFor(p[metric])}" r="3.5" fill="${color}"/>`;
    });
  });

  svg += `</svg>`;
  return svg;
}

function renderChart() {
  chartContainer.innerHTML = buildLineChart(resultsByAlgorithm, currentMetric);

  chartLegend.innerHTML = "";
  Object.keys(resultsByAlgorithm).forEach((algo) => {
    const span = document.createElement("span");
    const label = currentCategory === "sorting" ? `${names()[algo]} Sort` : names()[algo];
    span.innerHTML = `<i class="dot" style="background:${colors()[algo]}"></i>${label}`;
    chartLegend.appendChild(span);
  });
}

chartTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".chart-tab");
  if (!btn) return;
  chartTabs.querySelectorAll(".chart-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentMetric = btn.dataset.metric;
  renderChart();
});

function renderTable() {
  if (currentCategory === "sorting") {
    resultsThead.innerHTML = `<tr><th>Algorithm</th><th>Size</th><th>Type</th><th>Comparisons</th><th>Swaps</th><th>Time (ms)</th><th>Memory (KB)</th></tr>`;
  } else {
    resultsThead.innerHTML = `<tr><th>Algorithm</th><th>Grid</th><th>Walls</th><th>Visited</th><th>Path length</th><th>Found</th><th>Time (ms)</th><th>Memory (KB)</th></tr>`;
  }

  resultsTbody.innerHTML = "";
  Object.entries(resultsByAlgorithm).forEach(([algo, points]) => {
    [...points].sort((a, b) => a.size - b.size).forEach((p) => {
      const tr = document.createElement("tr");
      if (currentCategory === "sorting") {
        tr.innerHTML = `
          <td>${names()[algo]}</td>
          <td>${p.size}</td>
          <td>${p.array_type}</td>
          <td>${p.comparisons}</td>
          <td>${p.swaps}</td>
          <td>${p.execution_time_ms}</td>
          <td>${p.memory_kb}</td>`;
      } else {
        tr.innerHTML = `
          <td>${names()[algo]}</td>
          <td>${p.size}&times;${p.size}</td>
          <td>${p.array_type}</td>
          <td>${p.visited_count}</td>
          <td>${p.path_length}</td>
          <td>${p.path_found ? "Yes" : "No"}</td>
          <td>${p.execution_time_ms}</td>
          <td>${p.memory_kb}</td>`;
      }
      resultsTbody.appendChild(tr);
    });
  });
}

runBtn.addEventListener("click", async () => {
  const isSorting = currentCategory === "sorting";
  const algorithms = getChecked(isSorting ? "algo-checks" : "pf-algo-checks");
  const sizes = getChecked(isSorting ? "size-checks" : "pf-size-checks").map(Number);
  const arrayType = isSorting ? arrayTypeSelect.value : pfDensitySelect.value;

  if (algorithms.length === 0) { alert("Select at least one algorithm."); return; }
  if (sizes.length === 0) { alert(`Select at least one ${isSorting ? "input" : "grid"} size.`); return; }

  const jobs = [];
  algorithms.forEach(algo => sizes.forEach(size => jobs.push({ algo, size })));

  runBtn.disabled = true;
  runBtnLabel.textContent = "Running...";
  progressWrap.style.display = "block";
  progressFill.style.width = "0%";

  resultsByAlgorithm = {};
  algorithms.forEach(a => resultsByAlgorithm[a] = []);

  let completed = 0;
  for (const job of jobs) {
    const label = isSorting
      ? `Running ${names()[job.algo]} Sort @ n=${job.size}`
      : `Running ${names()[job.algo]} @ ${job.size}\u00d7${job.size} grid`;
    progressText.textContent = `${label} (${completed + 1}/${jobs.length})`;

    try {
      const result = await runBenchmark(job.algo, job.size, arrayType);
      resultsByAlgorithm[job.algo].push({
        size: job.size,
        array_type: arrayType,
        comparisons: result.comparisons,
        swaps: result.swaps,
        visited_count: result.visited_count,
        path_length: result.path_length,
        path_found: result.path_found,
        execution_time_ms: result.execution_time_ms,
        memory_kb: result.memory_kb
      });
    } catch (err) {
      console.error(`Benchmark failed for ${job.algo} @ ${job.size}:`, err);
    }
    completed++;
    progressFill.style.width = `${(completed / jobs.length) * 100}%`;
  }

  progressText.textContent = `Done — ${jobs.length} runs completed.`;
  runBtn.disabled = false;
  runBtnLabel.textContent = "Run Benchmark";

  chartPanel.style.display = "block";
  resultsCard.style.display = "block";
  renderChart();
  renderTable();
});

exportBtn.addEventListener("click", () => {
  let csv = "";
    if (currentCategory === "sorting") {
      csv += "Algorithm,Input Size,Array Type,Comparisons,Swaps,Execution Time (ms),Memory (KB)\n";
      Object.entries(resultsByAlgorithm).forEach(([algo, points]) => {
        points.forEach(p => {
          csv += [
            names()[algo],
            p.size,
            p.array_type,
            p.comparisons,
            p.swaps,
            p.execution_time_ms,
            p.memory_kb
          ].join(",") + "\n";
        });
      });
    } else {
      csv += "Algorithm,Grid Size,Wall Density,Visited Nodes,Path Length,Path Found,Execution Time (ms),Memory (KB)\n";
      Object.entries(resultsByAlgorithm).forEach(([algo, points]) => {
        points.forEach(p => {
          csv += [
          names()[algo],
          p.size + "x" + p.size,
          p.array_type,
          p.visited_count,
          p.path_length,
          p.path_found,
          p.execution_time_ms,
          p.memory_kb
        ].join(",") + "\n";
      });
    });
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `benchmark_${currentCategory}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});