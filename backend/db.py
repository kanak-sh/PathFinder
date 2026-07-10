"""
MySQL connection helper and schema setup for Benchmark Mode.

Uses mysql-connector-python. A fresh connection is opened per request
(simple and safe for a learning project's traffic level -- a connection
pool would be the next step for a production app).
"""

import mysql.connector
from mysql.connector import Error as MySQLError
from config import Config


def get_connection():
    return mysql.connector.connect(
        host=Config.DB_HOST,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
    )


CREATE_BENCHMARKS_TABLE = """
CREATE TABLE IF NOT EXISTS benchmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    algorithm VARCHAR(20) NOT NULL,
    input_size INT NOT NULL,
    array_type VARCHAR(20) NOT NULL DEFAULT 'random',
    comparisons INT NOT NULL,
    swaps INT NOT NULL,
    execution_time_ms FLOAT NOT NULL,
    memory_kb FLOAT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_algorithm (algorithm),
    INDEX idx_created_at (created_at)
);
"""


def init_db():
    """
    Create the benchmarks table if it doesn't exist yet. Called once at
    app startup. Failures are logged but don't crash the app -- the rest
    of PathFinder (sorting/pathfinding/compare) doesn't depend on MySQL,
    so a misconfigured DB shouldn't take down the whole backend.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(CREATE_BENCHMARKS_TABLE)
        conn.commit()
        cursor.close()
        conn.close()
        print("[db] Connected to MySQL and verified 'benchmarks' table.")
    except MySQLError as e:
        print(f"[db] WARNING: could not connect to MySQL ({e}). "
              f"Benchmark Mode will be unavailable until this is fixed.")
