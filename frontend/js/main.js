const statusEl = document.getElementById("status");
const arrayContainer = document.getElementById("array-container");
const barTooltip = document.getElementById("bar-tooltip");
const pillsContainer = document.getElementById("algo-pills");
const quickAlgoGrid = document.querySelector(".quick-algo-grid");
const sizeSlider = document.getElementById("size-slider");
const sizeValueLabel = document.getElementById("size-value");
const speedSlider = document.getElementById("speed-slider");
const speedValueLabel = document.getElementById("speed-value");
const generateBtn = document.getElementById("generate-btn");
const runBtn = document.getElementById("run-btn");
const runBtnIcon = document.getElementById("run-btn-icon");
const runBtnLabel = document.getElementById("run-btn-label");
const prevStepBtn = document.getElementById("prev-step-btn");
const nextStepBtn = document.getElementById("next-step-btn");
const stepCountEl = document.getElementById("step-count");
const stepDescEl = document.getElementById("step-desc");
const statComparisons = document.getElementById("stat-comparisons");
const statSwaps = document.getElementById("stat-swaps");
const statTime = document.getElementById("stat-time");
const statSize = document.getElementById("stat-size");

const aboutName = document.getElementById("about-name");
const aboutDesc = document.getElementById("about-desc");
const aboutTime = document.getElementById("about-time");
const aboutSpace = document.getElementById("about-space");
const aboutStable = document.getElementById("about-stable");
const aboutInplace = document.getElementById("about-inplace");

const PLAY_ICON = '<polygon points="6 4 20 12 6 20"/>';
const PAUSE_ICON = '<rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/>';
const SPEED_INTERVALS = { 1: 650, 2: 400, 3: 220, 4: 110, 5: 40 };

// Disabled nav items: show a gentle alert instead of doing nothing silently.
document.querySelectorAll(".nav-item.disabled").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    alert(el.dataset.tooltip || "This page isn't built yet.");
  });
});

const ALGO_INFO = {
  bubble: {
    name: "Bubble Sort",
    desc: "Repeatedly steps through the array, swapping adjacent elements that are out of order, until nothing more needs swapping.",
    time: "O(n\u00b2)", space: "O(1)", stable: true, inPlace: true
  },
  selection: {
    name: "Selection Sort",
    desc: "Finds the smallest remaining value on each pass and swaps it into place, building the sorted portion from the front.",
    time: "O(n\u00b2)", space: "O(1)", stable: false, inPlace: true
  },
  insertion: {
    name: "Insertion Sort",
    desc: "Takes each element and slides it backward into its correct position among the already-sorted elements before it.",
    time: "O(n\u00b2)", space: "O(1)", stable: true, inPlace: true
  },
  merge: {
    name: "Merge Sort",
    desc: "Splits the array in half again and again until each piece has one element, then merges them back in sorted order. The pink bar marks the current midpoint being merged around.",
    time: "O(n log n)", space: "O(n)", stable: true, inPlace: false
  },
  quick: {
    name: "Quick Sort",
    desc: "Picks a pivot (shown in pink), partitions everything smaller to its left and larger to its right, then repeats on each side.",
    time: "O(n log n)", space: "O(log n)", stable: false, inPlace: true
  },
  heap: {
    name: "Heap Sort",
    desc: "Builds a max-heap from the array, then repeatedly swaps the largest value to the end and shrinks the heap.",
    time: "O(n log n)", space: "O(1)", stable: false, inPlace: true
  }
};

let currentArray = [];
let currentAlgorithm = "bubble";
let currentSteps = [];
let currentStepIndex = -1;
let playTimer = null;

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

// --- Array generation ---
function generateRandomArray(size) {
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(Math.floor(Math.random() * 95) + 5);
  }
  return arr;
}

// --- Determine each bar's visual class for a given step ---
// Priority: sorted (lowest) < pivot/mid < comparing/active (highest, transient)
function computeBarClasses(step, arrayLength) {
  const classes = new Array(arrayLength).fill("");

  if (step.type === "done") {
    return classes.fill("sorted");
  }

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

// --- Rendering ---
function renderArray(array, classesArray = []) {
  arrayContainer.innerHTML = "";
  const max = Math.max(...array, 1);

  array.forEach((value, index) => {
    const bar = document.createElement("div");
    bar.className = "bar" + (classesArray[index] ? ` ${classesArray[index]}` : "");
    bar.style.height = `${(value / max) * 100}%`;

    bar.addEventListener("mouseenter", (e) => {
      barTooltip.textContent = value;
      barTooltip.style.display = "block";
    });
    bar.addEventListener("mousemove", (e) => {
      barTooltip.style.left = `${e.clientX}px`;
      barTooltip.style.top = `${e.clientY}px`;
    });
    bar.addEventListener("mouseleave", () => {
      barTooltip.style.display = "none";
    });

    arrayContainer.appendChild(bar);
  });
}

function updateStats({ comparisons, swaps, execution_time_ms }) {
  statComparisons.textContent = comparisons;
  statSwaps.textContent = swaps;
  statTime.textContent = `${execution_time_ms} ms`;
  statSize.textContent = currentArray.length;
}

function describeStep(step) {
  if (!step) return "Generate an array and hit Go to begin.";
  switch (step.type) {
    case "compare":
      return `Comparing values at positions ${step.indices[0]} and ${step.indices[1]}`;
    case "swap":
      return `Swapping values at positions ${step.indices[0]} and ${step.indices[1]}`;
    case "overwrite":
      return `Placing value into position ${step.indices[0]}`;
    case "done":
      return "Array fully sorted!";
    default:
      return "";
  }
}

function renderStep(index) {
  if (currentSteps.length === 0) {
    stepCountEl.textContent = "Step 0 / 0";
    stepDescEl.textContent = "Generate an array and hit Go to begin.";
    renderArray(currentArray);
    updateNavButtons();
    return;
  }

  const clampedIndex = Math.max(0, Math.min(index, currentSteps.length - 1));
  currentStepIndex = clampedIndex;
  const step = currentSteps[clampedIndex];

  stepCountEl.textContent = `Step ${clampedIndex + 1} / ${currentSteps.length}`;
  stepDescEl.textContent = describeStep(step);

  const classes = computeBarClasses(step, step.array.length);
  renderArray(step.array, classes);
  updateNavButtons();
}

function updateNavButtons() {
  prevStepBtn.disabled = currentSteps.length === 0 || currentStepIndex <= 0;
  nextStepBtn.disabled = currentSteps.length === 0 || currentStepIndex >= currentSteps.length - 1;
}

// --- About card ---
function updateAboutCard(algorithm) {
  const info = ALGO_INFO[algorithm];
  aboutName.textContent = info.name;
  aboutDesc.textContent = info.desc;
  aboutTime.innerHTML = info.time.replace("\u00b2", "&sup2;");
  aboutSpace.textContent = info.space;
  aboutStable.textContent = info.stable ? "Yes" : "No";
  aboutStable.className = info.stable ? "ok-text" : "warn-text";
  aboutInplace.textContent = info.inPlace ? "Yes" : "No";
  aboutInplace.className = info.inPlace ? "ok-text" : "warn-text";
}

// --- Keep pills + quick-algo buttons + about card all in sync ---
function selectAlgorithm(algorithm) {
  if (isPlaying()) stopPlaying();

  currentAlgorithm = algorithm;
  currentSteps = [];
  currentStepIndex = -1;

  pillsContainer.querySelectorAll(".pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.algorithm === algorithm);
  });
  quickAlgoGrid.querySelectorAll(".quick-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.algorithm === algorithm);
  });

  updateAboutCard(algorithm);
  renderStep(-1);
  statComparisons.textContent = "-";
  statSwaps.textContent = "-";
  statTime.textContent = "-";
}

pillsContainer.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  selectAlgorithm(btn.dataset.algorithm);
});

quickAlgoGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".quick-btn");
  if (!btn) return;
  selectAlgorithm(btn.dataset.algorithm);
});

// --- Sliders ---
sizeSlider.addEventListener("input", () => {
  sizeValueLabel.textContent = sizeSlider.value;
});

speedSlider.addEventListener("input", () => {
  speedValueLabel.textContent = `${speedSlider.value}x`;
});

// --- Generate / Shuffle ---
generateBtn.addEventListener("click", () => {
  if (isPlaying()) stopPlaying();
  currentArray = generateRandomArray(parseInt(sizeSlider.value, 10));
  currentSteps = [];
  currentStepIndex = -1;
  renderStep(-1);
  statComparisons.textContent = "-";
  statSwaps.textContent = "-";
  statTime.textContent = "-";
  statSize.textContent = currentArray.length;
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
    renderStep(currentStepIndex + 1);
  }, SPEED_INTERVALS[speedSlider.value] || 220);

  setRunButtonIcon(PAUSE_ICON, "Pause");
  generateBtn.disabled = true;
  sizeSlider.disabled = true;
  pillsContainer.querySelectorAll(".pill").forEach((p) => p.disabled = true);
}

function stopPlaying() {
  clearInterval(playTimer);
  playTimer = null;
  setRunButtonIcon(PLAY_ICON, "Go");
  generateBtn.disabled = false;
  sizeSlider.disabled = false;
  pillsContainer.querySelectorAll(".pill").forEach((p) => p.disabled = false);
}

// --- Run / Play / Pause ---
runBtn.addEventListener("click", async () => {
  if (isPlaying()) {
    stopPlaying();
    return;
  }

  // Already have steps loaded (paused mid-way, or finished) -> just resume/replay.
  if (currentSteps.length > 0) {
    if (currentStepIndex >= currentSteps.length - 1) {
      renderStep(0);
    }
    startPlaying();
    return;
  }

  if (currentArray.length === 0) {
    alert("Shuffle an array first.");
    return;
  }

  runBtn.disabled = true;
  runBtnLabel.textContent = "Loading...";

  try {
    const result = await runSort(currentAlgorithm, currentArray);
    currentSteps = result.steps;
    updateStats(result);
    renderStep(0);
    runBtn.disabled = false;
    startPlaying();
  } catch (err) {
    alert(`Error running algorithm: ${err.message}`);
    console.error(err);
    runBtn.disabled = false;
    setRunButtonIcon(PLAY_ICON, "Go");
  }
});

// --- Manual step navigation (also pauses auto-play) ---
prevStepBtn.addEventListener("click", () => {
  if (isPlaying()) stopPlaying();
  renderStep(currentStepIndex - 1);
});
nextStepBtn.addEventListener("click", () => {
  if (isPlaying()) stopPlaying();
  renderStep(currentStepIndex + 1);
});

// --- Initial state on page load ---
currentArray = generateRandomArray(parseInt(sizeSlider.value, 10));
renderStep(-1);
statSize.textContent = currentArray.length;
updateAboutCard(currentAlgorithm);