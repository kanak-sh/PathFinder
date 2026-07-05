const statusEl = document.getElementById("status");

pingBackend()
  .then((data) => {
    statusEl.textContent = `Connected to backend: ${data.message}`;
    statusEl.classList.add("ok");
  })
  .catch((err) => {
    statusEl.textContent = "Could not reach backend. Is Flask running on port 5000?";
    statusEl.classList.add("error");
    console.error(err);
  });
