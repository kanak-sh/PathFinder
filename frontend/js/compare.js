const statusEl = document.getElementById("status");
const categoryTabs = document.getElementById("category-tabs");
const sortingPanelControls = document.getElementById("sorting-panel-controls");
const pathfindingPanelControls = document.getElementById("pathfinding-panel-controls");

const algoASelect = document.getElementById("algo-a-select");
const algoBSelect = document.getElementById("algo-b-select");
const sizeSlider = document.getElementById("size-slider");
const sizeValueLabel = document.getElementById("size-value");
const speedSlider = document.getElementById("speed-slider");
const speedValueLabel = document.getElementById("speed-value");
const generateBtn = document.getElementById("generate-btn");

const pfAlgoASelect = document.getElementById("pf-algo-a-select");
const pfAlgoBSelect = document.getElementById("pf-algo-b-select");
const pfSizeSlider = document.getElementById("pf-size-slider");
const pfSizeValueLabel = document.getElementById("pf-size-value");
const pfSpeedSlider = document.getElementById("pf-speed-slider");
const pfSpeedValueLabel = document.getElementById("pf-speed-value");
const pfMazeBtn = document.getElementById("pf-maze-btn");

const runBtn = document.getElementById("run-btn");
const runBtnIcon = document.getElementById("run-btn-icon");
const runBtnLabel = document.getElementById("run-btn-label");
const winnerCard = document.getElementById("winner-card");
const winnerGrid = document.getElementById("winner-grid");

const arrayContainerA = document.getElementById("array-container-a");
const arrayContainerB = document.getElementById("array-container-b");
const gridContainerA = document.getElementById("grid-container-a");
const gridContainerB = document.getElementById("grid-container-b");

const SORTING_NAMES = {
  bubble: "Bubble Sort", selection: "Selection Sort", insertion: "Insertion Sort",
  merge: "Merge Sort", quick: "Quick Sort", heap: "Heap Sort"
};
const PATHFINDING_NAMES = {
  bfs: "BFS", dfs: "DFS", dijkstra: "Dijkstra", astar: "A*", greedy: "Greedy Best-First"
};

const PLAY_ICON = '<polygon points="6 4 20 12 6 20"/>';
const PAUSE_ICON = '<rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/>';
const SORTING_SPEED_INTERVALS = { 1: 400, 2: 220, 3: 120, 4: 55, 5: 20 };
const PF_SPEED_INTERVALS = { 1: 90, 2: 45, 3: 20, 4: 8, 5: 2 };

let currentCategory = "sorting";
let currentArray = [];
let playTimer = null;

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

function isPlaying() { return playTimer !== null; }
function setRunButtonIcon(icon, label) { runBtnIcon.innerHTML = icon; runBtnLabel.textContent = label; }

/* ============================== SORTING MODE ============================== */

function makeSortingPanel(key) {
  return {
    key,
    algorithm: null,
    container: key === "a" ? arrayContainerA : arrayContainerB,
    nameEl: document.getElementById(`panel-${key}-name`),
    statusEl: document.getElementById(`panel-${key}-status`),
    statTime: document.getElementById(`stat-${key}-time`),
    statSteps: document.getElementById(`stat-${key}-steps`),
    steps: [], stepIndex: -1, comparisons: 0, swaps: 0, execTimeMs: 0, finished: false
  };
}

const sortA = makeSortingPanel("a");
const sortB = makeSortingPanel("b");

function generateRandomArray(size) {
  const arr = [];
  for (let i = 0; i < size; i++) arr.push(Math.floor(Math.random() * 95) + 5);
  return arr;
}

function computeBarClasses(step, arrayLength) {
  const classes = new Array(arrayLength).fill("");
  if (step.type === "done") return classes.fill("sorted");
  if (typeof step.sorted_from === "number") for (let i = step.sorted_from; i < arrayLength; i++) classes[i] = "sorted";
  if (typeof step.sorted_upto === "number") for (let i = 0; i < step.sorted_upto; i++) classes[i] = "sorted";
  if (typeof step.pivot === "number") classes[step.pivot] = "pivot";
  if (typeof step.mid === "number") classes[step.mid] = "pivot";
  if (step.indices && step.indices.length) {
    const opClass = step.type === "compare" ? "comparing" : "active";
    step.indices.forEach((idx) => { classes[idx] = opClass; });
  }
  return classes;
}

function renderSortingArray(panel, array, classesArray = []) {
  panel.container.innerHTML = "";
  const max = Math.max(...array, 1);
  array.forEach((value, index) => {
    const bar = document.createElement("div");
    bar.className = "bar" + (classesArray[index] ? ` ${classesArray[index]}` : "");
    bar.style.height = `${(value / max) * 100}%`;
    panel.container.appendChild(bar);
  });
}

function resetSortingPanel(panel) {
  panel.steps = []; panel.stepIndex = -1; panel.comparisons = 0; panel.swaps = 0; panel.finished = false;
  panel.statusEl.textContent = "Waiting";
  panel.statusEl.className = "compare-status";
  document.getElementById(`label-${panel.key}-1`).textContent = "Comparisons";
  document.getElementById(`label-${panel.key}-2`).textContent = "Swaps";
  document.getElementById(`stat-${panel.key}-1`).textContent = "-";
  document.getElementById(`stat-${panel.key}-2`).textContent = "-";
  panel.statTime.textContent = "-";
  panel.statSteps.textContent = "-";
  renderSortingArray(panel, currentArray);
}

function updateSortingPanelNames() {
  sortA.algorithm = algoASelect.value;
  sortB.algorithm = algoBSelect.value;
  sortA.nameEl.textContent = SORTING_NAMES[sortA.algorithm];
  sortB.nameEl.textContent = SORTING_NAMES[sortB.algorithm];
}

function stepSortingPanel(panel) {
  if (panel.finished || panel.stepIndex >= panel.steps.length - 1) {
    if (!panel.finished) finishSortingPanel(panel);
    return;
  }
  panel.stepIndex++;
  const step = panel.steps[panel.stepIndex];
  if (step.type === "compare") panel.comparisons++;
  if (step.type === "swap") panel.swaps++;

  renderSortingArray(panel, step.array, computeBarClasses(step, step.array.length));
  document.getElementById(`stat-${panel.key}-1`).textContent = panel.comparisons;
  document.getElementById(`stat-${panel.key}-2`).textContent = panel.swaps;
  panel.statSteps.textContent = `${panel.stepIndex + 1} / ${panel.steps.length}`;

  if (panel.stepIndex >= panel.steps.length - 1) finishSortingPanel(panel);
}

function finishSortingPanel(panel) {
  panel.finished = true;
  panel.statusEl.textContent = "Done";
  panel.statusEl.className = "compare-status done";
  panel.statTime.textContent = `${panel.execTimeMs} ms`;
  if (sortA.finished && sortB.finished) { stopPlaying(); showSortingWinner(); }
}

function showSortingWinner() {
  const rows = [
    { label: "Fewer comparisons", a: sortA.comparisons, b: sortB.comparisons, unit: "" },
    { label: "Fewer swaps", a: sortA.swaps, b: sortB.swaps, unit: "" },
    { label: "Faster execution", a: sortA.execTimeMs, b: sortB.execTimeMs, unit: " ms" }
  ];
  renderWinnerCard(rows, SORTING_NAMES[sortA.algorithm], SORTING_NAMES[sortB.algorithm]);
}

/* ============================ PATHFINDING MODE ============================ */

function makePathfindingPanel(key) {
  return {
    key,
    algorithm: null,
    container: key === "a" ? gridContainerA : gridContainerB,
    nameEl: document.getElementById(`panel-${key}-name`),
    statusEl: document.getElementById(`panel-${key}-status`),
    statTime: document.getElementById(`stat-${key}-time`),
    statSteps: document.getElementById(`stat-${key}-steps`),
    cellElements: [], stepClasses: [],
    steps: [], stepIndex: -1, visitedCount: 0, pathLength: 0, pathFound: false, execTimeMs: 0, finished: false
  };
}

const pfA = makePathfindingPanel("a");
const pfB = makePathfindingPanel("b");

let pfCols = parseInt(pfSizeSlider.value, 10);
let pfRows = Math.max(6, Math.round(pfCols * 0.5));
let pfGrid = [];
let pfStart = [0, 0];
let pfEnd = [0, 0];

function initPfGridState(cols) {
  pfCols = cols;
  pfRows = Math.max(6, Math.round(cols * 0.5));
  pfGrid = Array.from({ length: pfRows }, () => Array(pfCols).fill(0));
  pfStart = [Math.floor(pfRows / 2), 1];
  pfEnd = [Math.floor(pfRows / 2), pfCols - 2];
}

function generatePfMaze() {
  for (let r = 0; r < pfRows; r++) {
    for (let c = 0; c < pfCols; c++) {
      const isEndpoint = (r === pfStart[0] && c === pfStart[1]) || (r === pfEnd[0] && c === pfEnd[1]);
      pfGrid[r][c] = isEndpoint ? 0 : (Math.random() < 0.24 ? 1 : 0);
    }
  }
}

function pfCellClass(panel, r, c) {
  if (r === pfStart[0] && c === pfStart[1]) return "start";
  if (r === pfEnd[0] && c === pfEnd[1]) return "end";
  if (pfGrid[r][c] === 1) return "wall";
  return panel.stepClasses[r][c] || "";
}

function buildPfGrid(panel) {
  panel.container.innerHTML = "";
  panel.container.style.gridTemplateColumns = `repeat(${pfCols}, 1fr)`;
  panel.cellElements = [];
  panel.stepClasses = Array.from({ length: pfRows }, () => Array(pfCols).fill(""));

  const fragment = document.createDocumentFragment();
  for (let r = 0; r < pfRows; r++) {
    const rowEls = [];
    for (let c = 0; c < pfCols; c++) {
      const cell = document.createElement("div");
      fragment.appendChild(cell);
      rowEls.push(cell);
    }
    panel.cellElements.push(rowEls);
  }
  panel.container.appendChild(fragment);
  refreshPfCells(panel);
}

function refreshPfCells(panel) {
  for (let r = 0; r < pfRows; r++) {
    for (let c = 0; c < pfCols; c++) {
      panel.cellElements[r][c].className = "cell " + pfCellClass(panel, r, c);
    }
  }
}

function resetPathfindingPanel(panel) {
  panel.steps = []; panel.stepIndex = -1;
  panel.visitedCount = 0; panel.pathLength = 0; panel.pathFound = false; panel.finished = false;
  panel.statusEl.textContent = "Waiting";
  panel.statusEl.className = "compare-status";
  document.getElementById(`label-${panel.key}-1`).textContent = "Visited";
  document.getElementById(`label-${panel.key}-2`).textContent = "Path length";
  document.getElementById(`stat-${panel.key}-1`).textContent = "-";
  document.getElementById(`stat-${panel.key}-2`).textContent = "-";
  panel.statTime.textContent = "-";
  panel.statSteps.textContent = "-";
  buildPfGrid(panel);
}

function updatePathfindingPanelNames() {
  pfA.algorithm = pfAlgoASelect.value;
  pfB.algorithm = pfAlgoBSelect.value;
  pfA.nameEl.textContent = PATHFINDING_NAMES[pfA.algorithm];
  pfB.nameEl.textContent = PATHFINDING_NAMES[pfB.algorithm];
}

function applyPfStep(panel, step) {
  if (step.type === "frontier" || step.type === "visit") {
    const [r, c] = step.node;
    if (!(r === pfStart[0] && c === pfStart[1]) && !(r === pfEnd[0] && c === pfEnd[1])) {
      panel.stepClasses[r][c] = step.type;
      panel.cellElements[r][c].className = "cell " + pfCellClass(panel, r, c);
    }
    if (step.type === "visit") panel.visitedCount++;
  } else if (step.type === "path") {
    panel.pathFound = true;
    panel.pathLength = step.path.length;
    step.path.forEach(([r, c]) => {
      if (!(r === pfStart[0] && c === pfStart[1]) && !(r === pfEnd[0] && c === pfEnd[1])) {
        panel.stepClasses[r][c] = "path";
        panel.cellElements[r][c].className = "cell " + pfCellClass(panel, r, c);
      }
    });
  } else if (step.type === "not_found") {
    panel.pathFound = false;
  }
}

function stepPathfindingPanel(panel) {
  if (panel.finished || panel.stepIndex >= panel.steps.length - 1) {
    if (!panel.finished) finishPathfindingPanel(panel);
    return;
  }
  panel.stepIndex++;
  applyPfStep(panel, panel.steps[panel.stepIndex]);
  document.getElementById(`stat-${panel.key}-1`).textContent = panel.visitedCount;
  document.getElementById(`stat-${panel.key}-2`).textContent = panel.pathFound ? panel.pathLength : "-";
  panel.statSteps.textContent = `${panel.stepIndex + 1} / ${panel.steps.length}`;

  if (panel.stepIndex >= panel.steps.length - 1) finishPathfindingPanel(panel);
}

function finishPathfindingPanel(panel) {
  panel.finished = true;
  panel.statusEl.textContent = "Done";
  panel.statusEl.className = "compare-status done";
  panel.statTime.textContent = `${panel.execTimeMs} ms`;
  if (pfA.finished && pfB.finished) { stopPlaying(); showPathfindingWinner(); }
}

function showPathfindingWinner() {
  const rows = [
    { label: "Fewer nodes visited", a: pfA.visitedCount, b: pfB.visitedCount, unit: "" },
    { label: "Shorter path", a: pfA.pathFound ? pfA.pathLength : Infinity, b: pfB.pathFound ? pfB.pathLength : Infinity, unit: "" },
    { label: "Faster execution", a: pfA.execTimeMs, b: pfB.execTimeMs, unit: " ms" }
  ];
  renderWinnerCard(rows, PATHFINDING_NAMES[pfA.algorithm], PATHFINDING_NAMES[pfB.algorithm]);
}

/* ============================== SHARED LOGIC ============================== */

function renderWinnerCard(rows, nameA, nameB) {
  winnerGrid.innerHTML = "";
  rows.forEach((row) => {
    const aVal = row.a === Infinity ? "no path" : row.a;
    const bVal = row.b === Infinity ? "no path" : row.b;
    const winnerName = row.a === row.b ? "Tie" : (row.a < row.b ? nameA : nameB);
    const div = document.createElement("div");
    div.className = "winner-item";
    div.innerHTML = `<span>${row.label}</span><strong>${winnerName} (${aVal}${row.unit} vs ${bVal}${row.unit})</strong>`;
    winnerGrid.appendChild(div);
  });
  winnerCard.style.display = "block";
}

function resetAll() {
  if (isPlaying()) stopPlaying();
  winnerCard.style.display = "none";
  if (currentCategory === "sorting") {
    resetSortingPanel(sortA);
    resetSortingPanel(sortB);
  } else {
    resetPathfindingPanel(pfA);
    resetPathfindingPanel(pfB);
  }
}

categoryTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  if (isPlaying()) stopPlaying();

  currentCategory = btn.dataset.category;
  categoryTabs.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");

  const isSorting = currentCategory === "sorting";
  sortingPanelControls.style.display = isSorting ? "block" : "none";
  pathfindingPanelControls.style.display = isSorting ? "none" : "block";
  arrayContainerA.style.display = isSorting ? "flex" : "none";
  arrayContainerB.style.display = isSorting ? "flex" : "none";
  gridContainerA.style.display = isSorting ? "none" : "grid";
  gridContainerB.style.display = isSorting ? "none" : "grid";

  if (isSorting) {
    updateSortingPanelNames();
  } else {
    updatePathfindingPanelNames();
    generatePfMaze();
  }
  resetAll();
});

algoASelect.addEventListener("change", () => { updateSortingPanelNames(); resetAll(); });
algoBSelect.addEventListener("change", () => { updateSortingPanelNames(); resetAll(); });
sizeSlider.addEventListener("input", () => { sizeValueLabel.textContent = sizeSlider.value; });
speedSlider.addEventListener("input", () => { speedValueLabel.textContent = `${speedSlider.value}x`; });
generateBtn.addEventListener("click", () => {
  currentArray = generateRandomArray(parseInt(sizeSlider.value, 10));
  resetAll();
});

pfAlgoASelect.addEventListener("change", () => { updatePathfindingPanelNames(); resetAll(); });
pfAlgoBSelect.addEventListener("change", () => { updatePathfindingPanelNames(); resetAll(); });
pfSizeSlider.addEventListener("input", () => { pfSizeValueLabel.textContent = pfSizeSlider.value; });
pfSizeSlider.addEventListener("change", () => {
  initPfGridState(parseInt(pfSizeSlider.value, 10));
  generatePfMaze();
  resetAll();
});
pfSpeedSlider.addEventListener("input", () => { pfSpeedValueLabel.textContent = `${pfSpeedSlider.value}x`; });
pfMazeBtn.addEventListener("click", () => {
  generatePfMaze();
  resetAll();
});

function startPlaying() {
  const panelPairA = currentCategory === "sorting" ? sortA : pfA;
  const panelPairB = currentCategory === "sorting" ? sortB : pfB;
  panelPairA.statusEl.textContent = "Running";
  panelPairA.statusEl.className = "compare-status running";
  panelPairB.statusEl.textContent = "Running";
  panelPairB.statusEl.className = "compare-status running";

  const isSorting = currentCategory === "sorting";
  const interval = isSorting
    ? (SORTING_SPEED_INTERVALS[speedSlider.value] || 120)
    : (PF_SPEED_INTERVALS[pfSpeedSlider.value] || 20);

  playTimer = setInterval(() => {
    if (isSorting) {
      stepSortingPanel(sortA);
      stepSortingPanel(sortB);
      if (sortA.finished && sortB.finished) stopPlaying();
    } else {
      stepPathfindingPanel(pfA);
      stepPathfindingPanel(pfB);
      if (pfA.finished && pfB.finished) stopPlaying();
    }
  }, interval);

  setRunButtonIcon(PAUSE_ICON, "Pause");
  generateBtn.disabled = true;
  sizeSlider.disabled = true;
  algoASelect.disabled = true;
  algoBSelect.disabled = true;
  pfMazeBtn.disabled = true;
  pfSizeSlider.disabled = true;
  pfAlgoASelect.disabled = true;
  pfAlgoBSelect.disabled = true;
}

function stopPlaying() {
  clearInterval(playTimer);
  playTimer = null;
  setRunButtonIcon(PLAY_ICON, "Race");
  generateBtn.disabled = false;
  sizeSlider.disabled = false;
  algoASelect.disabled = false;
  algoBSelect.disabled = false;
  pfMazeBtn.disabled = false;
  pfSizeSlider.disabled = false;
  pfAlgoASelect.disabled = false;
  pfAlgoBSelect.disabled = false;
}

runBtn.addEventListener("click", async () => {
  if (isPlaying()) { stopPlaying(); return; }

  if (currentCategory === "sorting") {
    if (currentArray.length === 0) { alert("Shuffle an array first."); return; }
    if (sortA.finished || sortB.finished || sortA.steps.length === 0) resetAll();

    runBtn.disabled = true;
    runBtnLabel.textContent = "Loading...";
    try {
      const [resultA, resultB] = await Promise.all([
        runSort(sortA.algorithm, currentArray),
        runSort(sortB.algorithm, currentArray)
      ]);
      sortA.steps = resultA.steps; sortA.execTimeMs = resultA.execution_time_ms;
      sortB.steps = resultB.steps; sortB.execTimeMs = resultB.execution_time_ms;
      sortA.statSteps.textContent = `0 / ${sortA.steps.length}`;
      sortB.statSteps.textContent = `0 / ${sortB.steps.length}`;
      runBtn.disabled = false;
      startPlaying();
    } catch (err) {
      alert(`Error running algorithms: ${err.message}`);
      console.error(err);
      runBtn.disabled = false;
      setRunButtonIcon(PLAY_ICON, "Race");
    }
  } else {
    if (pfA.finished || pfB.finished || pfA.steps.length === 0) resetAll();

    runBtn.disabled = true;
    runBtnLabel.textContent = "Loading...";
    try {
      const [resultA, resultB] = await Promise.all([
        runPathfind(pfA.algorithm, pfGrid, pfStart, pfEnd),
        runPathfind(pfB.algorithm, pfGrid, pfStart, pfEnd)
      ]);
      pfA.steps = resultA.steps; pfA.execTimeMs = resultA.execution_time_ms;
      pfB.steps = resultB.steps; pfB.execTimeMs = resultB.execution_time_ms;
      pfA.statSteps.textContent = `0 / ${pfA.steps.length}`;
      pfB.statSteps.textContent = `0 / ${pfB.steps.length}`;
      runBtn.disabled = false;
      startPlaying();
    } catch (err) {
      alert(`Error running algorithms: ${err.message}`);
      console.error(err);
      runBtn.disabled = false;
      setRunButtonIcon(PLAY_ICON, "Race");
    }
  }
});

updateSortingPanelNames();
currentArray = generateRandomArray(parseInt(sizeSlider.value, 10));
initPfGridState(pfCols);
generatePfMaze();
resetAll();