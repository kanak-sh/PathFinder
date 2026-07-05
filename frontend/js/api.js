// Base URL of the Flask backend.
// Update this if the backend runs on a different host/port.
const API_BASE_URL = "http://127.0.0.1:5000/api";

async function pingBackend() {
  const response = await fetch(`${API_BASE_URL}/ping`);
  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }
  return response.json();
}
