# PathFinder

A sorting & pathfinding algorithm visualizer with a Flask backend and a
plain HTML/CSS/JS frontend.

## Project Structure

```
PathFinder/
├── backend/
│   ├── app.py              # Flask entry point
│   ├── config.py           # App/DB configuration
│   ├── requirements.txt
│   ├── .env.example        # Copy to .env and fill in values
│   ├── algorithms/         # Sorting/pathfinding logic (added in later phases)
│   └── routes/             # API route blueprints (added in later phases)
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   ├── js/api.js           # Fetch calls to the backend
│   └── js/main.js
└── README.md
```

## Backend Setup

```bash
cd backend
python -m venv venv

# Activate the virtual environment
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

pip install -r requirements.txt
cp .env.example .env            # then edit values if needed

python app.py
```

The API will start at `http://127.0.0.1:5000`. Confirm it's running by
visiting `http://127.0.0.1:5000/api/ping` — you should see:

```json
{"status": "ok", "message": "pong"}
```

## Frontend Setup

No build step yet — it's plain HTML/CSS/JS. Just open the file directly,
or serve it locally to avoid any CORS/file:// quirks:

```bash
cd frontend
python -m http.server 5500
```

Then visit `http://127.0.0.1:5500`. The page should show
"Connected to backend: pong" once both servers are running.

## Status

**Phase 1: Project Setup — complete**
- [x] Repo structure
- [x] Flask app skeleton with health-check route
- [x] Frontend skeleton wired to call the backend
- [ ] Backend Core: sorting algorithms + step tracking (Phase 2)
- [ ] Frontend Core: render arrays, connect UI (Phase 3)

## Roadmap

1. Project Setup ✅
2. Backend Core (Flask API, algorithms with step-tracking)
3. Frontend Core (base UI, backend connection)
4. Sorting Visualizer (animations, playback controls)
5. Pathfinding Visualizer (grid, BFS/DFS/Dijkstra/A*)
6. Complexity Panel
7. Side-by-Side Comparison
8. Benchmark Mode + MySQL persistence
9. History Dashboard
10. Custom Input (uploads, generators)
11. Polish & Deploy
