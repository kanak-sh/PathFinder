const statusEl = document.getElementById("status");
const statRuns = document.getElementById("stat-runs");
const statFastest = document.getElementById("stat-fastest");

PathFinderUI.formatStatusPending(statusEl, "Checking connection...");

pingBackend()
  .then(() => PathFinderUI.formatStatus(statusEl, true, "Backend connected"))
  .catch(() => PathFinderUI.formatStatus(statusEl, false, "Backend offline"));

fetchBenchmarkStats()
  .then((data) => {
    if (data.total_runs > 0) {
      statRuns.textContent = data.total_runs.toLocaleString();
      if (data.fastest_run) {
        statFastest.textContent = data.fastest_run.execution_time_ms.toFixed(2);
      }
    } else {
      statRuns.textContent = "0";
      statFastest.textContent = "—";
    }
  })
  .catch(() => {
    statRuns.textContent = "—";
    statFastest.textContent = "—";
  });
