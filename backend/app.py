from flask import Flask, jsonify
from flask_cors import CORS
from config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Allow the plain HTML/JS frontend (served from a different port/file://)
    # to call this API during development.
    CORS(app)

    @app.route("/api/ping")
    def ping():
        return jsonify({"status": "ok", "message": "pong"})

    # Route blueprints (sorting, pathfinding, benchmarks, history) will be
    # registered here in later phases, e.g.:
    # from routes.sorting import sorting_bp
    # app.register_blueprint(sorting_bp, url_prefix="/api/sorting")

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
