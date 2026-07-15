const statusEl = document.getElementById("status");
const gridContainer = document.getElementById("grid-container");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const algoSelect = document.getElementById("algo-select");
const quickAlgoGrid = document.querySelector(".quick-algo-grid");
const sizeSelect = document.getElementById("size-select");
const speedSlider = document.getElementById("speed-slider");
const speedValueLabel = document.getElementById("speed-value");
const mazeBtn = document.getElementById("maze-btn");
const clearWallsBtn = document.getElementById("clear-walls-btn");
const resetBtn = document.getElementById("reset-btn");
const runBtn = document.getElementById("run-btn");
const runBtnIcon = document.getElementById("run-btn-icon");
const runBtnLabel = document.getElementById("run-btn-label");
const stepCountEl = document.getElementById("step-count");
const stepDescEl = document.getElementById("step-desc");
const statSteps = document.getElementById("stat-steps");
const statVisited = document.getElementById("stat-visited");
const statPathlen = document.getElementById("stat-pathlen");
const statTime = document.getElementById("stat-time");

const aboutName = document.getElementById("about-name");
const aboutDesc = document.getElementById("about-desc");
const aboutTime = document.getElementById("about-time");
const aboutSpace = document.getElementById("about-space");
const aboutOptimal = document.getElementById("about-optimal");
const aboutHeuristic = document.getElementById("about-heuristic");

const PLAY_ICON = '<polygon points="6 4 20 12 6 20"/>';
const PAUSE_ICON = '<rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/>';
const SPEED_INTERVALS = { 1: 120, 2: 60, 3: 30, 4: 12, 5: 3 };
const SPEED_LABELS = { 1: "Very slow", 2: "Slow", 3: "Medium", 4: "Fast", 5: "Very fast" };

document.querySelectorAll(".nav-item.disabled").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    alert(el.dataset.tooltip || "This page isn't built yet.");
  });
});

if (themeToggleBtn) themeToggleBtn.addEventListener("click", () => {
  alert("Dark mode is coming in the visual polish pass — this toggle is a placeholder for now.");
});

const ALGO_INFO = {
  bfs: {
    name: "BFS",
    desc: "Explores the grid in rings, layer by layer outward from the start. Finds the path with the fewest steps.",
    time: "O(V+E)", space: "O(V)", optimal: "Yes (steps)", heuristic: false
  },
  dfs: {
    name: "DFS",
    desc: "Dives as deep as possible down one path before backtracking. Fast, but usually finds a much longer route than necessary.",
    time: "O(V+E)", space: "O(V)", optimal: "No", heuristic: false
  },
  dijkstra: {
    name: "Dijkstra",
    desc: "Always expands the closest unvisited node by total cost so far. Guarantees the true shortest (cheapest) path, including diagonal cost differences.",
    time: "O((V+E) log V)", space: "O(V)", optimal: "Yes (cost)", heuristic: false
  },
  astar: {
    name: "A* Search",
    desc: "Like Dijkstra, but guided toward the goal by a distance estimate. Same optimal-cost guarantee, usually visiting far fewer nodes.",
    time: "O((V+E) log V)", space: "O(V)", optimal: "Yes (cost)", heuristic: true
  },
  greedy: {
    name: "Greedy Best-First",
    desc: "Always moves toward whatever looks closest to the goal, ignoring cost so far. Fast, but can be led down bad paths.",
    time: "O((V+E) log V)", space: "O(V)", optimal: "No", heuristic: true
  }
};

let cols = parseInt(sizeSelect.value, 10);
let rows = Math.max(8, Math.round(cols * 0.5));
let grid = [];
let cellElements = [];
let stepClasses = [];
let startPos = [0, 0];
let endPos = [0, 0];

let currentAlgorithm = algoSelect.value;
let currentSteps = [];
let currentStepIndex = -1;
let playTimer = null;
let needsRefetch = true;

let isMouseDown = false;
let drawMode = "add";
let draggingNode = null;

// --- Backend connectivity check ---
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

// --- Grid setup ---
function initGridState(newCols) {
  cols = newCols;
  rows = Math.max(8, Math.round(cols * 0.5));
  grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  stepClasses = Array.from({ length: rows }, () => Array(cols).fill(""));
  startPos = [Math.floor(rows / 2), 2];
  endPos = [Math.floor(rows / 2), cols - 3];
}

function cellClassFor(r, c) {
  if (r === startPos[0] && c === startPos[1]) return "start";
  if (r === endPos[0] && c === endPos[1]) return "end";
  if (grid[r][c] === 1) return "wall";
  return stepClasses[r][c] || "";
}

function buildGrid() {
  removePathOverlay();
  gridContainer.innerHTML = "";
  gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  cellElements = [];

  const fragment = document.createDocumentFragment();
  for (let r = 0; r < rows; r++) {
    const rowEls = [];
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.dataset.r = r;
      cell.dataset.c = c;
      fragment.appendChild(cell);
      rowEls.push(cell);
    }
    cellElements.push(rowEls);
  }
  gridContainer.appendChild(fragment);
  refreshAllCellClasses();
}

function refreshAllCellClasses() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cellElements[r][c].className = "cell " + cellClassFor(r, c);
    }
  }
}

function toggleWall(r, c, mode) {
  const newVal = mode === "add" ? 1 : 0;
  if (grid[r][c] === newVal) return;
  grid[r][c] = newVal;
  needsRefetch = true;
  cellElements[r][c].className = "cell " + cellClassFor(r, c);
}

// --- Mouse interaction: draw walls, drag start/end ---
gridContainer.addEventListener("dragstart", (e) => e.preventDefault());

gridContainer.addEventListener("mousedown", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const r = parseInt(cell.dataset.r, 10);
  const c = parseInt(cell.dataset.c, 10);

  if (r === startPos[0] && c === startPos[1]) { draggingNode = "start"; return; }
  if (r === endPos[0] && c === endPos[1]) { draggingNode = "end"; return; }

  isMouseDown = true;
  drawMode = grid[r][c] === 1 ? "remove" : "add";
  toggleWall(r, c, drawMode);
});

gridContainer.addEventListener("mouseover", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const r = parseInt(cell.dataset.r, 10);
  const c = parseInt(cell.dataset.c, 10);

  if (draggingNode) {
    if (grid[r][c] === 1) return;
    if (draggingNode === "start") {
      if (r === endPos[0] && c === endPos[1]) return;
      startPos = [r, c];
    } else {
      if (r === startPos[0] && c === startPos[1]) return;
      endPos = [r, c];
    }
    needsRefetch = true;
    refreshAllCellClasses();
    return;
  }

  if (isMouseDown) {
    if ((r === startPos[0] && c === startPos[1]) || (r === endPos[0] && c === endPos[1])) return;
    toggleWall(r, c, drawMode);
  }
});

window.addEventListener("mouseup", () => {
  isMouseDown = false;
  if (draggingNode) {
    draggingNode = null;
    needsRefetch = true;
  }
});

// --- Path line overlay ---
function removePathOverlay() {
  const existing = gridContainer.querySelector(".path-overlay");
  if (existing) existing.remove();
}

function drawPathOverlay(path) {
  removePathOverlay();
  if (!path || path.length < 2) return;

  const containerRect = gridContainer.getBoundingClientRect();
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.classList.add("path-overlay");
  svg.setAttribute("width", containerRect.width);
  svg.setAttribute("height", containerRect.height);

  const points = path.map(([r, c]) => {
    const rect = cellElements[r][c].getBoundingClientRect();
    return [
      rect.left - containerRect.left + rect.width / 2,
      rect.top - containerRect.top + rect.height / 2
    ];
  });

  const polyline = document.createElementNS(svgNS, "polyline");
  polyline.setAttribute("points", points.map(p => p.join(",")).join(" "));
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "#534AB7");
  polyline.setAttribute("stroke-width", "3");
  polyline.setAttribute("stroke-linecap", "round");
  polyline.setAttribute("stroke-linejoin", "round");
  svg.appendChild(polyline);

  points.forEach(([x, y], i) => {
    if (i === 0 || i === points.length - 1) return; // start/end already have their own markers
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 3.2);
    circle.setAttribute("fill", "#534AB7");
    svg.appendChild(circle);
  });

  gridContainer.appendChild(svg);
}

// --- Animation ---
function clearAnimation() {
  if (isPlaying()) stopPlaying();
  stepClasses = Array.from({ length: rows }, () => Array(cols).fill(""));
  currentSteps = [];
  currentStepIndex = -1;
  removePathOverlay();
  refreshAllCellClasses();
  stepCountEl.textContent = "Step 0 / 0";
  stepDescEl.textContent = "Draw some walls (optional) and hit Start to begin.";
  statSteps.textContent = "-";
  statVisited.textContent = "-";
  statPathlen.textContent = "-";
  statTime.textContent = "-";
}

function describeStep(step) {
  switch (step.type) {
    case "visit": return `Visiting cell (${step.node[0]}, ${step.node[1]})`;
    case "frontier": return `Adding cell (${step.node[0]}, ${step.node[1]}) to the frontier`;
    case "path": return "Path found! Tracing it back from the end.";
    case "not_found": return "No path exists between start and end.";
    default: return "";
  }
}

function applyStep(step) {
  if (step.type === "frontier" || step.type === "visit") {
    const [r, c] = step.node;
    if (!(r === startPos[0] && c === startPos[1]) && !(r === endPos[0] && c === endPos[1])) {
      stepClasses[r][c] = step.type;
      cellElements[r][c].className = "cell " + cellClassFor(r, c);
    }
  } else if (step.type === "path") {
    step.path.forEach(([r, c]) => {
      if (!(r === startPos[0] && c === startPos[1]) && !(r === endPos[0] && c === endPos[1])) {
        stepClasses[r][c] = "path";
        cellElements[r][c].className = "cell " + cellClassFor(r, c);
      }
    });
    drawPathOverlay(step.path);
  }
}

// --- About card ---
function updateAboutCard(algorithm) {
  const info = ALGO_INFO[algorithm];
  aboutName.textContent = info.name;
  aboutDesc.textContent = info.desc;
  aboutTime.textContent = info.time;
  aboutSpace.textContent = info.space;
  aboutOptimal.textContent = info.optimal;
  aboutOptimal.className = info.optimal.startsWith("Yes") ? "ok-text" : "warn-text";
  aboutHeuristic.textContent = info.heuristic ? "Yes" : "No";
  aboutHeuristic.className = info.heuristic ? "ok-text" : "warn-text";
}

function selectAlgorithm(algorithm) {
  currentAlgorithm = algorithm;
  needsRefetch = true;

  algoSelect.value = algorithm;
  quickAlgoGrid.querySelectorAll(".quick-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.algorithm === algorithm);
  });

  updateAboutCard(algorithm);
}

algoSelect.addEventListener("change", () => selectAlgorithm(algoSelect.value));

quickAlgoGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".quick-btn");
  if (!btn) return;
  selectAlgorithm(btn.dataset.algorithm);
});

// --- Grid size / speed controls ---
sizeSelect.addEventListener("change", () => {
  if (isPlaying()) stopPlaying();
  initGridState(parseInt(sizeSelect.value, 10));
  buildGrid();
  needsRefetch = true;
  stepCountEl.textContent = "Step 0 / 0";
  stepDescEl.textContent = "Draw some walls (optional) and hit Start to begin.";
  statSteps.textContent = "-";
  statVisited.textContent = "-";
  statPathlen.textContent = "-";
  statTime.textContent = "-";
});

speedSlider.addEventListener("input", () => {
  speedValueLabel.textContent = SPEED_LABELS[speedSlider.value] || "Medium";
});

// --- Maze / clear / reset ---
mazeBtn.addEventListener("click", () => {
  if (isPlaying()) stopPlaying();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r === startPos[0] && c === startPos[1]) || (r === endPos[0] && c === endPos[1])) {
        grid[r][c] = 0;
        continue;
      }
      grid[r][c] = Math.random() < 0.28 ? 1 : 0;
    }
  }
  clearAnimation();
  needsRefetch = true;
});

clearWallsBtn.addEventListener("click", () => {
  if (isPlaying()) stopPlaying();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) grid[r][c] = 0;
  }
  clearAnimation();
  needsRefetch = true;
});

resetBtn.addEventListener("click", () => {
  clearAnimation();
});

// --- Auto-play ---
function isPlaying() {
  return playTimer !== null;
}

function setRunButtonIcon(icon, label) {
  runBtnIcon.innerHTML = icon;
  runBtnLabel.textContent = label;
}

function startPlaying() {
  playTimer = setInterval(() => {
    if (currentStepIndex >= currentSteps.length - 1) {
      stopPlaying();
      return;
    }
    currentStepIndex++;
    const step = currentSteps[currentStepIndex];
    applyStep(step);
    stepCountEl.textContent = `Step ${currentStepIndex + 1} / ${currentSteps.length}`;
    stepDescEl.textContent = describeStep(step);
    statSteps.textContent = `${currentStepIndex + 1} / ${currentSteps.length}`;
    if (step.type === "visit") {
      statVisited.textContent = (parseInt(statVisited.textContent, 10) || 0) + 1;
    }
    if (step.type === "path") {
      statPathlen.textContent = step.path.length;
    } else if (step.type === "not_found") {
      statPathlen.textContent = "No path";
    }
  }, SPEED_INTERVALS[speedSlider.value] || 30);

  setRunButtonIcon(PAUSE_ICON, "Pause");
  mazeBtn.disabled = true;
  clearWallsBtn.disabled = true;
  sizeSelect.disabled = true;
  algoSelect.disabled = true;
}

function stopPlaying() {
  clearInterval(playTimer);
  playTimer = null;
  setRunButtonIcon(PLAY_ICON, "Start");
  mazeBtn.disabled = false;
  clearWallsBtn.disabled = false;
  sizeSelect.disabled = false;
  algoSelect.disabled = false;
}

runBtn.addEventListener("click", async () => {
  if (isPlaying()) {
    stopPlaying();
    return;
  }

  if (currentSteps.length > 0 && !needsRefetch) {
    if (currentStepIndex >= currentSteps.length - 1) {
      stepClasses = Array.from({ length: rows }, () => Array(cols).fill(""));
      removePathOverlay();
      refreshAllCellClasses();
      currentStepIndex = -1;
      statVisited.textContent = "0";
    }
    startPlaying();
    return;
  }

  runBtn.disabled = true;
  runBtnLabel.textContent = "Loading...";

  try {
    const result = await runPathfind(currentAlgorithm, grid, startPos, endPos);
    currentSteps = result.steps;
    currentStepIndex = -1;
    needsRefetch = false;

    stepClasses = Array.from({ length: rows }, () => Array(cols).fill(""));
    removePathOverlay();
    refreshAllCellClasses();
    statVisited.textContent = "0";

    runBtn.disabled = false;
    startPlaying();
  } catch (err) {
    alert(`Error running algorithm: ${err.message}`);
    console.error(err);
    runBtn.disabled = false;
    setRunButtonIcon(PLAY_ICON, "Start");
  }
});

// --- Initial state on page load ---
initGridState(cols);
buildGrid();
updateAboutCard(currentAlgorithm);
speedValueLabel.textContent = SPEED_LABELS[speedSlider.value];
