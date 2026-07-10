const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run-btn");
const runBtnLabel = document.getElementById("run-btn-label");
const arrayTypeSelect = document.getElementById("array-type-select");
const progressWrap = document.getElementById("bench-progress");
const progressFill = document.getElementById("bench-progress-fill");
const progressText = document.getElementById("bench-progress-text");
const chartPanel = document.getElementById("chart-panel");
const chartTabs = document.getElementById("chart-tabs");
const chartContainer = document.getElementById("chart-container");
const chartLegend = document.getElementById("chart-legend");
const resultsCard = document.getElementById("results-table-card");
const resultsTbody = document.getElementById("results-tbody");

const ALGO_NAMES = {
  bubble: "Bubble", selection: "Selection", insertion: "Insertion",
  merge: "Merge", quick: "Quick", heap: "Heap"
};
const ALGO_COLORS = {
  bubble: "#D85A30", selection: "#D4537E", insertion: "#7F77DD",
  merge: "#534AB7", quick: "#1D9E75", heap: "#EF9F27"
};
const METRIC_LABELS = {
  execution_time_ms: "Time (ms)",
  comparisons: "Comparisons",
  memory_kb: "Memory (KB)"
};

let resultsByAlgorithm = {};
let currentMetric = "execution_time_ms";

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

function getChecked(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(cb => cb.value);
}

function buildLineChart(seriesByAlgo, metric) {
  const width = 900, height = 320, padL = 55, padR = 20, padT = 20, padB = 40;
  const innerW = width - padL - padR, innerH = height - padT - padB;

  const allPoints = Object.values(seriesByAlgo).flat();
  if (allPoints.length === 0) return "<p style='color:#888780;font-size:12px;'>No data yet.</p>";

  const sizes = [...new Set(allPoints.map(p => p.size))].sort((a, b) => a - b);
  const maxVal = Math.max(...allPoints.map(p => p[metric]), 1);
  const minSize = sizes[0], maxSize = sizes[sizes.length - 1];

  const xFor = (size) => padL + (maxSize === minSize ? 0 : (size - minSize) / (maxSize - minSize)) * innerW;
  const yFor = (val) => padT + innerH - (val / maxVal) * innerH;

  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

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
    const color = ALGO_COLORS[algo];
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
    span.innerHTML = `<i class="dot" style="background:${ALGO_COLORS[algo]}"></i>${ALGO_NAMES[algo]} Sort`;
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
  resultsTbody.innerHTML = "";
  Object.entries(resultsByAlgorithm).forEach(([algo, points]) => {
    [...points].sort((a, b) => a.size - b.size).forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ALGO_NAMES[algo]}</td>
        <td>${p.size}</td>
        <td>${p.array_type}</td>
        <td>${p.comparisons}</td>
        <td>${p.swaps}</td>
        <td>${p.execution_time_ms}</td>
        <td>${p.memory_kb}</td>`;
      resultsTbody.appendChild(tr);
    });
  });
}

runBtn.addEventListener("click", async () => {
  const algorithms = getChecked("algo-checks");
  const sizes = getChecked("size-checks").map(Number);
  const arrayType = arrayTypeSelect.value;

  if (algorithms.length === 0) { alert("Select at least one algorithm."); return; }
  if (sizes.length === 0) { alert("Select at least one input size."); return; }

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
    progressText.textContent = `Running ${ALGO_NAMES[job.algo]} Sort @ n=${job.size} (${completed + 1}/${jobs.length})`;
    try {
      const result = await runBenchmark(job.algo, job.size, arrayType);
      resultsByAlgorithm[job.algo].push({
        size: job.size,
        array_type: arrayType,
        comparisons: result.comparisons,
        swaps: result.swaps,
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