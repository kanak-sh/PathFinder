const statusEl = document.getElementById("status");
const algoASelect = document.getElementById("algo-a-select");
const algoBSelect = document.getElementById("algo-b-select");
const sizeSlider = document.getElementById("size-slider");
const sizeValueLabel = document.getElementById("size-value");
const speedSlider = document.getElementById("speed-slider");
const speedValueLabel = document.getElementById("speed-value");
const generateBtn = document.getElementById("generate-btn");
const runBtn = document.getElementById("run-btn");
const runBtnIcon = document.getElementById("run-btn-icon");
const runBtnLabel = document.getElementById("run-btn-label");
const winnerCard = document.getElementById("winner-card");
const winnerGrid = document.getElementById("winner-grid");

const ALGO_NAMES = {
  bubble: "Bubble Sort", selection: "Selection Sort", insertion: "Insertion Sort",
  merge: "Merge Sort", quick: "Quick Sort", heap: "Heap Sort"
};

const PLAY_ICON = '<polygon points="6 4 20 12 6 20"/>';
const PAUSE_ICON = '<rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/>';
const SPEED_INTERVALS = { 1: 400, 2: 220, 3: 120, 4: 55, 5: 20 };

let currentArray = [];
let playTimer = null;

function makePanel(key) {
  return {
    key,
    algorithm: null,
    container: document.getElementById(`array-container-${key}`),
    nameEl: document.getElementById(`panel-${key}-name`),
    statusEl: document.getElementById(`panel-${key}-status`),
    statComparisons: document.getElementById(`stat-${key}-comparisons`),
    statSwaps: document.getElementById(`stat-${key}-swaps`),
    statTime: document.getElementById(`stat-${key}-time`),
    statSteps: document.getElementById(`stat-${key}-steps`),
    steps: [],
    stepIndex: -1,
    comparisons: 0,
    swaps: 0,
    execTimeMs: 0,
    finished: false
  };
}

const panelA = makePanel("a");
const panelB = makePanel("b");

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

function generateRandomArray(size) {
  const arr = [];
  for (let i = 0; i < size; i++) arr.push(Math.floor(Math.random() * 95) + 5);
  return arr;
}

function computeBarClasses(step, arrayLength) {
  const classes = new Array(arrayLength).fill("");
  if (step.type === "done") return classes.fill("sorted");

  if (typeof step.sorted_from === "number") {
    for (let idx = step.sorted_from; idx < arrayLength; idx++) classes[idx] = "sorted";
  }
  if (typeof step.sorted_upto === "number") {
    for (let idx = 0; idx < step.sorted_upto; idx++) classes[idx] = "sorted";
  }
  if (typeof step.pivot === "number") classes[step.pivot] = "pivot";
  if (typeof step.mid === "number") classes[step.mid] = "pivot";
  if (step.indices && step.indices.length) {
    const opClass = step.type === "compare" ? "comparing" : "active";
    step.indices.forEach((idx) => { classes[idx] = opClass; });
  }
  return classes;
}

function renderPanelArray(panel, array, classesArray = []) {
  panel.container.innerHTML = "";
  const max = Math.max(...array, 1);
  array.forEach((value, index) => {
    const bar = document.createElement("div");
    bar.className = "bar" + (classesArray[index] ? ` ${classesArray[index]}` : "");
    bar.style.height = `${(value / max) * 100}%`;
    panel.container.appendChild(bar);
  });
}

function resetPanelDisplay(panel) {
  panel.steps = [];
  panel.stepIndex = -1;
  panel.comparisons = 0;
  panel.swaps = 0;
  panel.finished = false;
  panel.statusEl.textContent = "Waiting";
  panel.statusEl.className = "compare-status";
  panel.statComparisons.textContent = "-";
  panel.statSwaps.textContent = "-";
  panel.statTime.textContent = "-";
  panel.statSteps.textContent = "-";
  renderPanelArray(panel, currentArray);
}

function updatePanelNames() {
  panelA.algorithm = algoASelect.value;
  panelB.algorithm = algoBSelect.value;
  panelA.nameEl.textContent = ALGO_NAMES[panelA.algorithm];
  panelB.nameEl.textContent = ALGO_NAMES[panelB.algorithm];
}

algoASelect.addEventListener("change", () => { updatePanelNames(); resetAll(); });
algoBSelect.addEventListener("change", () => { updatePanelNames(); resetAll(); });

sizeSlider.addEventListener("input", () => { sizeValueLabel.textContent = sizeSlider.value; });
speedSlider.addEventListener("input", () => { speedValueLabel.textContent = `${speedSlider.value}x`; });

function resetAll() {
  if (isPlaying()) stopPlaying();
  resetPanelDisplay(panelA);
  resetPanelDisplay(panelB);
  winnerCard.style.display = "none";
}

generateBtn.addEventListener("click", () => {
  currentArray = generateRandomArray(parseInt(sizeSlider.value, 10));
  resetAll();
});

function isPlaying() { return playTimer !== null; }

function setRunButtonIcon(icon, label) {
  runBtnIcon.innerHTML = icon;
  runBtnLabel.textContent = label;
}

function stepPanel(panel) {
  if (panel.finished || panel.stepIndex >= panel.steps.length - 1) {
    if (!panel.finished) finishPanel(panel);
    return;
  }
  panel.stepIndex++;
  const step = panel.steps[panel.stepIndex];
  if (step.type === "compare") panel.comparisons++;
  if (step.type === "swap") panel.swaps++;

  const classes = computeBarClasses(step, step.array.length);
  renderPanelArray(panel, step.array, classes);
  panel.statComparisons.textContent = panel.comparisons;
  panel.statSwaps.textContent = panel.swaps;
  panel.statSteps.textContent = `${panel.stepIndex + 1} / ${panel.steps.length}`;

  if (panel.stepIndex >= panel.steps.length - 1) finishPanel(panel);
}

function finishPanel(panel) {
  panel.finished = true;
  panel.statusEl.textContent = "Done";
  panel.statusEl.className = "compare-status done";
  panel.statTime.textContent = `${panel.execTimeMs} ms`;

  if (panelA.finished && panelB.finished) {
    stopPlaying();
    showWinner();
  }
}

function startPlaying() {
  panelA.statusEl.textContent = "Running";
  panelA.statusEl.className = "compare-status running";
  panelB.statusEl.textContent = "Running";
  panelB.statusEl.className = "compare-status running";

  playTimer = setInterval(() => {
    stepPanel(panelA);
    stepPanel(panelB);
    if (panelA.finished && panelB.finished) stopPlaying();
  }, SPEED_INTERVALS[speedSlider.value] || 120);

  setRunButtonIcon(PAUSE_ICON, "Pause");
  generateBtn.disabled = true;
  sizeSlider.disabled = true;
  algoASelect.disabled = true;
  algoBSelect.disabled = true;
}

function stopPlaying() {
  clearInterval(playTimer);
  playTimer = null;
  setRunButtonIcon(PLAY_ICON, "Race");
  generateBtn.disabled = false;
  sizeSlider.disabled = false;
  algoASelect.disabled = false;
  algoBSelect.disabled = false;
}

function showWinner() {
  const rows = [
    { label: "Fewer comparisons", a: panelA.comparisons, b: panelB.comparisons, unit: "" },
    { label: "Fewer swaps", a: panelA.swaps, b: panelB.swaps, unit: "" },
    { label: "Faster execution", a: panelA.execTimeMs, b: panelB.execTimeMs, unit: " ms" }
  ];

  winnerGrid.innerHTML = "";
  rows.forEach((row) => {
    const winnerName = row.a === row.b
      ? "Tie"
      : (row.a < row.b ? ALGO_NAMES[panelA.algorithm] : ALGO_NAMES[panelB.algorithm]);
    const div = document.createElement("div");
    div.className = "winner-item";
    div.innerHTML = `<span>${row.label}</span><strong>${winnerName} (${row.a}${row.unit} vs ${row.b}${row.unit})</strong>`;
    winnerGrid.appendChild(div);
  });

  winnerCard.style.display = "block";
}

runBtn.addEventListener("click", async () => {
  if (isPlaying()) {
    stopPlaying();
    return;
  }

  if (currentArray.length === 0) {
    alert("Shuffle an array first.");
    return;
  }

  if (panelA.finished || panelB.finished || panelA.steps.length === 0) {
    resetAll();
  }

  runBtn.disabled = true;
  runBtnLabel.textContent = "Loading...";

  try {
    const [resultA, resultB] = await Promise.all([
      runSort(panelA.algorithm, currentArray),
      runSort(panelB.algorithm, currentArray)
    ]);

    panelA.steps = resultA.steps;
    panelA.execTimeMs = resultA.execution_time_ms;
    panelB.steps = resultB.steps;
    panelB.execTimeMs = resultB.execution_time_ms;

    panelA.statSteps.textContent = `0 / ${panelA.steps.length}`;
    panelB.statSteps.textContent = `0 / ${panelB.steps.length}`;

    runBtn.disabled = false;
    startPlaying();
  } catch (err) {
    alert(`Error running algorithms: ${err.message}`);
    console.error(err);
    runBtn.disabled = false;
    setRunButtonIcon(PLAY_ICON, "Race");
  }
});

updatePanelNames();
currentArray = generateRandomArray(parseInt(sizeSlider.value, 10));
resetAll();