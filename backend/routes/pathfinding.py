from flask import Blueprint, request, jsonify
from algorithms.pathfinding import ALGORITHMS

pathfinding_bp = Blueprint("pathfinding", __name__)


@pathfinding_bp.route("/<algorithm>", methods=["POST"])
def run_pathfind(algorithm):
    """
    POST /api/pathfinding/<algorithm>
    Body: {
        "grid": [[0,0,1,...], ...],   # 0 = open, 1 = wall
        "start": [row, col],
        "end": [row, col]
    }

    Returns the full step history for the requested algorithm.
    """
    if algorithm not in ALGORITHMS:
        return jsonify({
            "error": f"Unknown algorithm '{algorithm}'. "
                     f"Available: {list(ALGORITHMS.keys())}"
        }), 400

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    grid = data.get("grid")
    start = data.get("start")
    end = data.get("end")

    if not isinstance(grid, list) or len(grid) == 0 or not isinstance(grid[0], list):
        return jsonify({"error": "'grid' must be a non-empty 2D list"}), 400

    rows, cols = len(grid), len(grid[0])
    if any(len(row) != cols for row in grid):
        return jsonify({"error": "'grid' rows must all be the same length"}), 400

    def valid_cell(cell):
        return (
            isinstance(cell, list) and len(cell) == 2
            and isinstance(cell[0], int) and isinstance(cell[1], int)
            and 0 <= cell[0] < rows and 0 <= cell[1] < cols
        )

    if not valid_cell(start):
        return jsonify({"error": "'start' must be [row, col] within grid bounds"}), 400
    if not valid_cell(end):
        return jsonify({"error": "'end' must be [row, col] within grid bounds"}), 400

    if grid[start[0]][start[1]] == 1:
        return jsonify({"error": "'start' cannot be on a wall"}), 400
    if grid[end[0]][end[1]] == 1:
        return jsonify({"error": "'end' cannot be on a wall"}), 400

    result = ALGORITHMS[algorithm](grid, start, end)

    return jsonify({
        "algorithm": algorithm,
        "rows": rows,
        "cols": cols,
        **result
    })
