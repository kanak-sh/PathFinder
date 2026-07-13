const statusEl = document.getElementById("status");
const categoryTabs = document.getElementById("category-tabs");
const statTotalRuns = document.getElementById("stat-total-runs");
const statFastest = document.getElementById("stat-fastest");
const statSlowest = document.getElementById("stat-slowest");
const statAverage = document.getElementById("stat-average");
const statFavourite = document.getElementById("stat-favourite");
const algoBreakdownTbody = document.getElementById("algo-breakdown-tbody");
const runsThead = document.getElementById("runs-thead");
const runsTbody = document.getElementById("runs-tbody");
const runsCountText = document.getElementById("runs-count-text");
const filterSelect = document.getElementById("filter-select");
const loadMoreBtn = document.getElementById("load-more-btn");

const SORTING_NAMES = {
  bubble: "Bubble Sort", selection: "Selection Sort", insertion: "Insertion Sort",
  merge: "Merge Sort", quick: "Quick Sort", heap: "Heap Sort"
};
const PATHFINDING_NAMES = {
  bfs: "BFS", dfs: "DFS", dijkstra: "Dijkstra", astar: "A*", greedy: "Greedy Best-First"
};

let currentCategory = "sorting";
const PAGE_SIZE = 25;
let currentOffset = 0;
let currentTotal = 0;

function names() { return currentCategory === "sorting" ? SORTING_NAMES : PATHFINDING_NAMES; }

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

function formatWhen(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function populateFilterOptions() {
  filterSelect.innerHTML = `<option value="">All algorithms</option>`;
  Object.entries(names()).forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    filterSelect.appendChild(opt);
  });
}

function setRunsTableHeader() {
  if (currentCategory === "sorting") {
    runsThead.innerHTML = `<tr><th>Algorithm</th><th>Size</th><th>Type</th><th>Comparisons</th><th>Swaps</th><th>Time (ms)</th><th>Memory (KB)</th><th>When</th></tr>`;
  } else {
    runsThead.innerHTML = `<tr><th>Algorithm</th><th>Grid</th><th>Walls</th><th>Visited</th><th>Path length</th><th>Found</th><th>Time (ms)</th><th>Memory (KB)</th><th>When</th></tr>`;
  }
}

async function loadStats() {
  try {
    const data = await fetchBenchmarkStats(currentCategory);

    if (data.total_runs === 0) {
      statTotalRuns.textContent = "0";
      statFastest.textContent = "No runs yet";
      statSlowest.textContent = "No runs yet";
      statAverage.textContent = "-";
      statFavourite.textContent = "-";
      algoBreakdownTbody.innerHTML = `<tr><td colspan="5">No benchmark runs yet in this category. Go run some on the Benchmarks page.</td></tr>`;
      return;
    }

    statTotalRuns.textContent = data.total_runs;

    const f = data.fastest_run;
    statFastest.textContent = `${f.execution_time_ms} ms`;
    statFastest.title = `${names()[f.algorithm]} @ ${f.input_size}`;

    const s = data.slowest_run;
    statSlowest.textContent = `${s.execution_time_ms} ms`;
    statSlowest.title = `${names()[s.algorithm]} @ ${s.input_size}`;

    statAverage.textContent = `${data.average_time_ms} ms`;

    const fav = data.favourite_algorithm;
    statFavourite.textContent = `${names()[fav.algorithm]} (${fav.run_count})`;

    algoBreakdownTbody.innerHTML = "";
    data.per_algorithm.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${names()[row.algorithm] || row.algorithm}</td>
        <td>${row.run_count}</td>
        <td>${row.avg_time_ms}</td>
        <td>${row.min_time_ms}</td>
        <td>${row.max_time_ms}</td>`;
      algoBreakdownTbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load stats:", err);
    statFastest.textContent = "Error";
    statSlowest.textContent = "Error";
  }
}

async function loadRuns(append = false) {
  const algorithm = filterSelect.value || null;

  try {
    const data = await fetchBenchmarkHistory(algorithm, PAGE_SIZE, currentOffset, currentCategory);
    currentTotal = data.total;

    if (!append) runsTbody.innerHTML = "";

    if (data.results.length === 0 && !append) {
      const colspan = currentCategory === "sorting" ? 8 : 9;
      runsTbody.innerHTML = `<tr><td colspan="${colspan}">No runs found for this filter.</td></tr>`;
    } else {
      data.results.forEach((row) => {
        const tr = document.createElement("tr");
        if (currentCategory === "sorting") {
          tr.innerHTML = `
            <td>${names()[row.algorithm] || row.algorithm}</td>
            <td>${row.input_size}</td>
            <td>${row.array_type}</td>
            <td>${row.comparisons}</td>
            <td>${row.swaps}</td>
            <td>${row.execution_time_ms}</td>
            <td>${row.memory_kb}</td>
            <td>${formatWhen(row.created_at)}</td>`;
        } else {
          tr.innerHTML = `
            <td>${names()[row.algorithm] || row.algorithm}</td>
            <td>${row.input_size}&times;${row.input_size}</td>
            <td>${row.array_type}</td>
            <td>${row.visited_count}</td>
            <td>${row.path_length}</td>
            <td>${row.path_found ? "Yes" : "No"}</td>
            <td>${row.execution_time_ms}</td>
            <td>${row.memory_kb}</td>
            <td>${formatWhen(row.created_at)}</td>`;
        }
        runsTbody.appendChild(tr);
      });
    }

    currentOffset += data.results.length;
    runsCountText.textContent = `Showing ${currentOffset} of ${currentTotal}`;
    loadMoreBtn.style.display = currentOffset >= currentTotal ? "none" : "inline-flex";
  } catch (err) {
    console.error("Failed to load runs:", err);
    const colspan = currentCategory === "sorting" ? 8 : 9;
    runsTbody.innerHTML = `<tr><td colspan="${colspan}">Could not load run history.</td></tr>`;
  }
}

function reloadEverything() {
  currentOffset = 0;
  setRunsTableHeader();
  populateFilterOptions();
  loadStats();
  loadRuns(false);
}

categoryTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  currentCategory = btn.dataset.category;
  categoryTabs.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  reloadEverything();
});

filterSelect.addEventListener("change", () => {
  currentOffset = 0;
  loadRuns(false);
});

loadMoreBtn.addEventListener("click", () => {
  loadRuns(true);
});

reloadEverything();