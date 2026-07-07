const API_BASE_URL = "http://127.0.0.1:5000/api";

async function pingBackend() {
  const response = await fetch(`${API_BASE_URL}/ping`);
  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }
  return response.json();
}

async function runSort(algorithm, array) {
  const response = await fetch(`${API_BASE_URL}/sorting/${algorithm}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ array })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Backend responded with status ${response.status}`);
  }

  return response.json();
}