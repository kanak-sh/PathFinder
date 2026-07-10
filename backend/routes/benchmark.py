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
    GET /api/benchmark/history?algorithm=bubble&limit=50
    Returns past benchmark runs, most recent first. 'algorithm' is optional.
    """
    algorithm = request.args.get("algorithm")
    try:
        limit = int(request.args.get("limit", 200))
    except ValueError:
        limit = 200
    limit = max(1, min(limit, 1000))

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        if algorithm:
            cursor.execute(
                """SELECT id, algorithm, input_size, array_type, comparisons, swaps,
                          execution_time_ms, memory_kb, created_at
                   FROM benchmarks WHERE algorithm = %s
                   ORDER BY created_at DESC LIMIT %s""",
                (algorithm, limit)
            )
        else:
            cursor.execute(
                """SELECT id, algorithm, input_size, array_type, comparisons, swaps,
                          execution_time_ms, memory_kb, created_at
                   FROM benchmarks ORDER BY created_at DESC LIMIT %s""",
                (limit,)
            )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        for row in rows:
            row["created_at"] = row["created_at"].isoformat()

        return jsonify({"count": len(rows), "results": rows})
    except MySQLError as e:
        return jsonify({"error": f"Could not read benchmark history: {e}"}), 500
