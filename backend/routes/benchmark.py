import random
from flask import Blueprint, request, jsonify
from algorithms.benchmark import run_benchmark, BENCHMARK_ALGORITHMS
from db import get_connection
from mysql.connector import Error as MySQLError

benchmark_bp = Blueprint("benchmark", __name__)

MAX_INPUT_SIZE = 20000  # safety cap -- O(n^2) algorithms get very slow past this


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
    Body: {
        "algorithm": "bubble",
        "input_size": 500,
        "array_type": "random"   # optional: random | sorted | reverse | nearly_sorted | duplicates
    }
    Runs the algorithm once (no animation), stores the result in MySQL,
    and returns it.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    algorithm = data.get("algorithm")
    input_size = data.get("input_size")
    array_type = data.get("array_type", "random")

    if algorithm not in BENCHMARK_ALGORITHMS:
        return jsonify({
            "error": f"Unknown algorithm '{algorithm}'. Available: {list(BENCHMARK_ALGORITHMS.keys())}"
        }), 400

    if not isinstance(input_size, int) or input_size <= 0:
        return jsonify({"error": "'input_size' must be a positive integer"}), 400

    if input_size > MAX_INPUT_SIZE:
        return jsonify({"error": f"'input_size' cannot exceed {MAX_INPUT_SIZE}"}), 400

    valid_types = {"random", "sorted", "reverse", "nearly_sorted", "duplicates"}
    if array_type not in valid_types:
        return jsonify({"error": f"'array_type' must be one of {sorted(valid_types)}"}), 400

    array = _generate_array(input_size, array_type)
    result = run_benchmark(algorithm, array)

    row_id = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO benchmarks
                (algorithm, input_size, array_type, comparisons, swaps, execution_time_ms, memory_kb)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (algorithm, input_size, array_type, result["comparisons"], result["swaps"],
             result["execution_time_ms"], result["memory_kb"])
        )
        conn.commit()
        row_id = cursor.lastrowid
        cursor.close()
        conn.close()
    except MySQLError as e:
        # Benchmark still ran successfully -- just couldn't persist it.
        return jsonify({
            "algorithm": algorithm,
            "input_size": input_size,
            "array_type": array_type,
            **result,
            "stored": False,
            "storage_error": str(e)
        })

    return jsonify({
        "id": row_id,
        "algorithm": algorithm,
        "input_size": input_size,
        "array_type": array_type,
        **result,
        "stored": True
    })


@benchmark_bp.route("/history", methods=["GET"])
def history():
    """
    GET /api/benchmark/history?algorithm=bubble&limit=50&offset=0
    Returns past benchmark runs, most recent first. 'algorithm' is optional.
    """
    algorithm = request.args.get("algorithm")
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

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        if algorithm:
            cursor.execute(
                """SELECT id, algorithm, input_size, array_type, comparisons, swaps,
                          execution_time_ms, memory_kb, created_at
                   FROM benchmarks WHERE algorithm = %s
                   ORDER BY created_at DESC LIMIT %s OFFSET %s""",
                (algorithm, limit, offset)
            )
        else:
            cursor.execute(
                """SELECT id, algorithm, input_size, array_type, comparisons, swaps,
                          execution_time_ms, memory_kb, created_at
                   FROM benchmarks ORDER BY created_at DESC LIMIT %s OFFSET %s""",
                (limit, offset)
            )
        rows = cursor.fetchall()

        count_cursor = conn.cursor(dictionary=True)
        if algorithm:
            count_cursor.execute("SELECT COUNT(*) AS total FROM benchmarks WHERE algorithm = %s", (algorithm,))
        else:
            count_cursor.execute("SELECT COUNT(*) AS total FROM benchmarks")
        total = count_cursor.fetchone()["total"]

        cursor.close()
        count_cursor.close()
        conn.close()

        for row in rows:
            row["created_at"] = row["created_at"].isoformat()

        return jsonify({"count": len(rows), "total": total, "offset": offset, "results": rows})
    except MySQLError as e:
        return jsonify({"error": f"Could not read benchmark history: {e}"}), 500


@benchmark_bp.route("/stats", methods=["GET"])
def stats():
    """
    GET /api/benchmark/stats
    Returns aggregate stats across every stored run: fastest run, slowest
    run, overall average time, the most-frequently-run algorithm, total
    run count, and a per-algorithm breakdown (count + average time).
    """
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT COUNT(*) AS total_runs FROM benchmarks")
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
            """SELECT id, algorithm, input_size, array_type, execution_time_ms, memory_kb, created_at
               FROM benchmarks ORDER BY execution_time_ms ASC LIMIT 1"""
        )
        fastest_run = cursor.fetchone()

        cursor.execute(
            """SELECT id, algorithm, input_size, array_type, execution_time_ms, memory_kb, created_at
               FROM benchmarks ORDER BY execution_time_ms DESC LIMIT 1"""
        )
        slowest_run = cursor.fetchone()

        cursor.execute("SELECT AVG(execution_time_ms) AS avg_time FROM benchmarks")
        average_time_ms = cursor.fetchone()["avg_time"]

        cursor.execute(
            """SELECT algorithm, COUNT(*) AS run_count
               FROM benchmarks GROUP BY algorithm ORDER BY run_count DESC LIMIT 1"""
        )
        favourite_algorithm = cursor.fetchone()

        cursor.execute(
            """SELECT algorithm, COUNT(*) AS run_count,
                      AVG(execution_time_ms) AS avg_time_ms,
                      MIN(execution_time_ms) AS min_time_ms,
                      MAX(execution_time_ms) AS max_time_ms
               FROM benchmarks GROUP BY algorithm ORDER BY run_count DESC"""
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