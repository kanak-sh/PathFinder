from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from routes.sorting import sorting_bp
from routes.pathfinding import pathfinding_bp
from routes.benchmark import benchmark_bp
from db import init_db

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Allow the plain HTML/JS frontend (served from a different port/file://)
    # to call this API during development.
    CORS(app)

    @app.route("/api/ping")
    def ping():
        return jsonify({"status": "ok", "message": "pong"})

    app.register_blueprint(sorting_bp, url_prefix="/api/sorting")
    app.register_blueprint(pathfinding_bp, url_prefix="/api/pathfinding")
    app.register_blueprint(benchmark_bp, url_prefix="/api/benchmark")

    # Route blueprint for History Dashboard queries will be registered
    # here in a later phase (it reuses the same 'benchmarks' table).

    init_db()

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)