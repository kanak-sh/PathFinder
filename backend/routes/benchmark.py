import random
from flask import Blueprint, request, jsonify
from algorithms.benchmark import run_benchmark, BENCHMARK_ALGORITHMS
from algorithms.pathfinding_benchmark import (
    run_pathfinding_benchmark, generate_grid, PATHFINDING_BENCHMARK_ALGORITHMS
)
from db import get_connection
from mysql.connector import Error as MySQLError

benchmark_bp = Blueprint("benchmark", __name__)

MAX_INPUT_SIZE = 20000     # sorting: safety cap, O(n^2) algorithms get very slow past this
MAX_GRID_SIZE = 300        # pathfinding: grid is size x size, so this caps at 90,000 cells

SORTING_VALID_TYPES = {"random", "sorted", "reverse", "nearly_sorted", "duplicates"}
PATHFINDING_VALID_TYPES = {"sparse", "dense", "maze"}


def _category_for(algorithm):
    if algorithm in BENCHMARK_ALGORITHMS:
        return "sorting"
    if algorithm in PATHFINDING_BENCHMARK_ALGORITHMS:
        return "pathfinding"
    return None


def _generate_array(size, array_type):
    if array_type == "sorted":
        return list(range(size))
    if array_type == "reverse":
        return list(range(size, 0, -1))
    if array_type == "nearly_sorted":
        arr = list(range(size))
        swaps = max(1, size // 20)
        for _ in range(swaps):
            i, j = random.randrange(size), random.randrange(size)
            arr[i], arr[j] = arr[j], arr[i]
        return arr
    if array_type == "duplicates":
        pool = max(1, size // 10)
        return [random.randint(0, pool) for _ in range(size)]
    # default: random
    return random.sample(range(size * 10 + 1), size) if size > 0 else []


@benchmark_bp.route("/run", methods=["POST"])
def run():
    """
    POST /api/benchmark/run
    Body (sorting):
        { "algorithm": "bubble", "input_size": 500, "array_type": "random" }
    Body (pathfinding):
        { "algorithm": "bfs", "input_size": 50, "array_type": "sparse" }
        -- input_size is the grid's side length (a 50 means a 50x50 grid);
           array_type here means wall density: sparse | dense | maze

    Runs the algorithm once (no animation), stores the result in MySQL,
    and returns it. The algorithm name alone determines whether this is
    a sorting or pathfinding run.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    algorithm = data.get("algorithm")
    input_size = data.get("input_size")
    array_type = data.get("array_type", "random")

    category = _category_for(algorithm)
    if category is None:
        available = list(BENCHMARK_ALGORITHMS.keys()) + list(PATHFINDING_BENCHMARK_ALGORITHMS.keys())
        return jsonify({"error": f"Unknown algorithm '{algorithm}'. Available: {available}"}), 400

    if not isinstance(input_size, int) or input_size <= 0:
        return jsonify({"error": "'input_size' must be a positive integer"}), 400

    if category == "sorting":
        if input_size > MAX_INPUT_SIZE:
            return jsonify({"error": f"'input_size' cannot exceed {MAX_INPUT_SIZE}"}), 400
        if array_type not in SORTING_VALID_TYPES:
            return jsonify({"error": f"'array_type' must be one of {sorted(SORTING_VALID_TYPES)}"}), 400

        array = _generate_array(input_size, array_type)
        result = run_benchmark(algorithm, array)
        metric_columns = {
            "comparisons": result["comparisons"],
            "swaps": result["swaps"],
            "visited_count": None,
            "path_length": None,
            "path_found": None,
        }
    else:  # pathfinding
        if input_size > MAX_GRID_SIZE:
            return jsonify({"error": f"'input_size' (grid side length) cannot exceed {MAX_GRID_SIZE}"}), 400
        if array_type not in PATHFINDING_VALID_TYPES and array_type != "random":
            return jsonify({"error": f"'array_type' must be one of {sorted(PATHFINDING_VALID_TYPES)}"}), 400
        variant = array_type if array_type in PATHFINDING_VALID_TYPES else "sparse"

        grid = generate_grid(input_size, variant)
        start, end = [0, 0], [input_size - 1, input_size - 1]
        result = run_pathfinding_benchmark(algorithm, grid, start, end)
        array_type = variant
        metric_columns = {
            "comparisons": None,
            "swaps": None,
            "visited_count": result["visited_count"],
            "path_length": result["path_length"],
            "path_found": result["path_found"],
        }

    row_id = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO benchmarks
                (category, algorithm, input_size, array_type, comparisons, swaps,
                 visited_count, path_length, path_found, execution_time_ms, memory_kb)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (category, algorithm, input_size, array_type,
             metric_columns["comparisons"], metric_columns["swaps"],
             metric_columns["visited_count"], metric_columns["path_length"], metric_columns["path_found"],
             result["execution_time_ms"], result["memory_kb"])
        )
        conn.commit()
        row_id = cursor.lastrowid
        cursor.close()
        conn.close()
    except MySQLError as e:
        # Benchmark still ran successfully -- just couldn't persist it.
        return jsonify({
            "category": category,
            "algorithm": algorithm,
            "input_size": input_size,
            "array_type": array_type,
            **result,
            "stored": False,
            "storage_error": str(e)
        })

    return jsonify({
        "id": row_id,
        "category": category,
        "algorithm": algorithm,
        "input_size": input_size,
        "array_type": array_type,
        **result,
        "stored": True
    })


@benchmark_bp.route("/history", methods=["GET"])
def history():
    """
    GET /api/benchmark/history?algorithm=bubble&category=sorting&limit=50&offset=0
    Returns past benchmark runs, most recent first. 'algorithm' and
    'category' are both optional filters.
    """
    algorithm = request.args.get("algorithm")
    category = request.args.get("category")

    try:
        limit = int(request.args.get("limit", 200))
    except ValueError:
        limit = 200
    limit = max(1, min(limit, 1000))

    try:
        offset = int(request.args.get("offset", 0))
    except ValueError:
        offset = 0
    offset = max(0, offset)

    filters = []
    params = []
    if algorithm:
        filters.append("algorithm = %s")
        params.append(algorithm)
    if category:
        filters.append("category = %s")
        params.append(category)
    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""SELECT id, category, algorithm, input_size, array_type,
                       comparisons, swaps, visited_count, path_length, path_found,
                       execution_time_ms, memory_kb, created_at
                FROM benchmarks {where_clause}
                ORDER BY created_at DESC LIMIT %s OFFSET %s""",
            (*params, limit, offset)
        )
        rows = cursor.fetchall()

        count_cursor = conn.cursor(dictionary=True)
        count_cursor.execute(f"SELECT COUNT(*) AS total FROM benchmarks {where_clause}", tuple(params))
        total = count_cursor.fetchone()["total"]

        cursor.close()
        count_cursor.close()
        conn.close()

        for row in rows:
            row["created_at"] = row["created_at"].isoformat()
            if row["path_found"] is not None:
                row["path_found"] = bool(row["path_found"])

        return jsonify({"count": len(rows), "total": total, "offset": offset, "results": rows})
    except MySQLError as e:
        return jsonify({"error": f"Could not read benchmark history: {e}"}), 500


@benchmark_bp.route("/stats", methods=["GET"])
def stats():
    """
    GET /api/benchmark/stats?category=sorting
    Returns aggregate stats across stored runs: fastest run, slowest run,
    overall average time, the most-frequently-run algorithm, total run
    count, and a per-algorithm breakdown. 'category' is optional
    (sorting | pathfinding); omit it to combine both.
    """
    category = request.args.get("category")
    where_clause = "WHERE category = %s" if category else ""
    params = (category,) if category else ()

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(f"SELECT COUNT(*) AS total_runs FROM benchmarks {where_clause}", params)
        total_runs = cursor.fetchone()["total_runs"]

        if total_runs == 0:
            cursor.close()
            conn.close()
            return jsonify({
                "total_runs": 0,
                "fastest_run": None,
                "slowest_run": None,
                "average_time_ms": None,
                "favourite_algorithm": None,
                "per_algorithm": []
            })

        cursor.execute(
            f"""SELECT id, category, algorithm, input_size, array_type, execution_time_ms, memory_kb, created_at
                FROM benchmarks {where_clause} ORDER BY execution_time_ms ASC LIMIT 1""",
            params
        )
        fastest_run = cursor.fetchone()

        cursor.execute(
            f"""SELECT id, category, algorithm, input_size, array_type, execution_time_ms, memory_kb, created_at
                FROM benchmarks {where_clause} ORDER BY execution_time_ms DESC LIMIT 1""",
            params
        )
        slowest_run = cursor.fetchone()

        cursor.execute(f"SELECT AVG(execution_time_ms) AS avg_time FROM benchmarks {where_clause}", params)
        average_time_ms = cursor.fetchone()["avg_time"]

        cursor.execute(
            f"""SELECT algorithm, COUNT(*) AS run_count
                FROM benchmarks {where_clause} GROUP BY algorithm ORDER BY run_count DESC LIMIT 1""",
            params
        )
        favourite_algorithm = cursor.fetchone()

        cursor.execute(
            f"""SELECT algorithm, COUNT(*) AS run_count,
                       AVG(execution_time_ms) AS avg_time_ms,
                       MIN(execution_time_ms) AS min_time_ms,
                       MAX(execution_time_ms) AS max_time_ms
                FROM benchmarks {where_clause} GROUP BY algorithm ORDER BY run_count DESC""",
            params
        )
        per_algorithm = cursor.fetchall()

        cursor.close()
        conn.close()

        for run in (fastest_run, slowest_run):
            if run and run.get("created_at"):
                run["created_at"] = run["created_at"].isoformat()

        return jsonify({
            "total_runs": total_runs,
            "fastest_run": fastest_run,
            "slowest_run": slowest_run,
            "average_time_ms": round(average_time_ms, 4) if average_time_ms is not None else None,
            "favourite_algorithm": favourite_algorithm,
            "per_algorithm": [
                {
                    "algorithm": row["algorithm"],
                    "run_count": row["run_count"],
                    "avg_time_ms": round(row["avg_time_ms"], 4),
                    "min_time_ms": round(row["min_time_ms"], 4),
                    "max_time_ms": round(row["max_time_ms"], 4),
                }
                for row in per_algorithm
            ]
        })
    except MySQLError as e:
        return jsonify({"error": f"Could not compute benchmark stats: {e}"}), 500
