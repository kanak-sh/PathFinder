import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """
    Central place for app configuration.
    DB settings are placeholders for now — wired up in the
    Benchmark Mode / MySQL phase.
    """
    DEBUG = os.getenv("FLASK_DEBUG", "True") == "True"
    HOST = os.getenv("FLASK_HOST", "127.0.0.1")
    PORT = int(os.getenv("FLASK_PORT", 5000))

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "pathfinder")
