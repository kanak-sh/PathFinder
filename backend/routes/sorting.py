from flask import Blueprint, request, jsonify
from algorithms.sorting import ALGORITHMS

sorting_bp = Blueprint("sorting", __name__)


@sorting_bp.route("/<algorithm>", methods=["POST"])
def run_sort(algorithm):
    """
    POST /api/sorting/<algorithm>
    Body: { "array": [5, 3, 8, 1, 9] }

    Returns the full step history for the requested algorithm.
    """
    if algorithm not in ALGORITHMS:
        return jsonify({
            "error": f"Unknown algorithm '{algorithm}'. "
                     f"Available: {list(ALGORITHMS.keys())}"
        }), 400

    data = request.get_json(silent=True)
    if not data or "array" not in data:
        return jsonify({"error": "Request body must include an 'array' field"}), 400

    array = data["array"]

    if not isinstance(array, list) or not all(isinstance(x, (int, float)) for x in array):
        return jsonify({"error": "'array' must be a list of numbers"}), 400

    if len(array) == 0:
        return jsonify({"error": "'array' must not be empty"}), 400

    result = ALGORITHMS[algorithm](array)

    return jsonify({
        "algorithm": algorithm,
        "input_size": len(array),
        **result
    })