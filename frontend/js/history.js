const statusEl = document.getElementById("status");
const statTotalRuns = document.getElementById("stat-total-runs");
const statFastest = document.getElementById("stat-fastest");
const statSlowest = document.getElementById("stat-slowest");
const statAverage = document.getElementById("stat-average");
const statFavourite = document.getElementById("stat-favourite");
const algoBreakdownTbody = document.getElementById("algo-breakdown-tbody");
const runsTbody = document.getElementById("runs-tbody");
const runsCountText = document.getElementById("runs-count-text");
const filterSelect = document.getElementById("filter-select");
const loadMoreBtn = document.getElementById("load-more-btn");

const ALGO_NAMES = {
  bubble: "Bubble Sort", selection: "Selection Sort", insertion: "Insertion Sort",
  merge: "Merge Sort", quick: "Quick Sort", heap: "Heap Sort"
};

const PAGE_SIZE = 25;
let currentOffset = 0;
let currentTotal = 0;

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

async function loadStats() {
  try {
    const data = await fetchBenchmarkStats();

    if (data.total_runs === 0) {
      statTotalRuns.textContent = "0";
      statFastest.textContent = "No runs yet";
      statSlowest.textContent = "No runs yet";
      statAverage.textContent = "-";
      statFavourite.textContent = "-";
      algoBreakdownTbody.innerHTML = `<tr><td colspan="5">No benchmark runs yet. Go run some on the Benchmarks page.</td></tr>`;
      return;
    }

    statTotalRuns.textContent = data.total_runs;

    const f = data.fastest_run;
    statFastest.textContent = `${f.execution_time_ms} ms`;
    statFastest.title = `${ALGO_NAMES[f.algorithm]} @ n=${f.input_size}`;

    const s = data.slowest_run;
    statSlowest.textContent = `${s.execution_time_ms} ms`;
    statSlowest.title = `${ALGO_NAMES[s.algorithm]} @ n=${s.input_size}`;

    statAverage.textContent = `${data.average_time_ms} ms`;

    const fav = data.favourite_algorithm;
    statFavourite.textContent = `${ALGO_NAMES[fav.algorithm]} (${fav.run_count})`;

    algoBreakdownTbody.innerHTML = "";
    data.per_algorithm.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ALGO_NAMES[row.algorithm]}</td>
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
    const data = await fetchBenchmarkHistory(algorithm, PAGE_SIZE, currentOffset);
    currentTotal = data.total;

    if (!append) runsTbody.innerHTML = "";

    if (data.results.length === 0 && !append) {
      runsTbody.innerHTML = `<tr><td colspan="8">No runs found for this filter.</td></tr>`;
    } else {
      data.results.forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${ALGO_NAMES[row.algorithm] || row.algorithm}</td>
          <td>${row.input_size}</td>
          <td>${row.array_type}</td>
          <td>${row.comparisons}</td>
          <td>${row.swaps}</td>
          <td>${row.execution_time_ms}</td>
          <td>${row.memory_kb}</td>
          <td>${formatWhen(row.created_at)}</td>`;
        runsTbody.appendChild(tr);
      });
    }

    currentOffset += data.results.length;
    runsCountText.textContent = `Showing ${currentOffset} of ${currentTotal}`;
    loadMoreBtn.style.display = currentOffset >= currentTotal ? "none" : "inline-flex";
  } catch (err) {
    console.error("Failed to load runs:", err);
    runsTbody.innerHTML = `<tr><td colspan="8">Could not load run history.</td></tr>`;
  }
}

filterSelect.addEventListener("change", () => {
  currentOffset = 0;
  loadRuns(false);
});

loadMoreBtn.addEventListener("click", () => {
  loadRuns(true);
});

// --- Initial load ---
loadStats();
loadRuns(false);