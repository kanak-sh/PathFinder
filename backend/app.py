from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from routes.sorting import sorting_bp

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

    # Route blueprints for pathfinding, benchmarks, and history will be
    # registered here in later phases.

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)