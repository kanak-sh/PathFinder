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
    category VARCHAR(20) NOT NULL DEFAULT 'sorting',
    algorithm VARCHAR(20) NOT NULL,
    input_size INT NOT NULL,
    array_type VARCHAR(20) NOT NULL DEFAULT 'random',
    comparisons INT NULL,
    swaps INT NULL,
    visited_count INT NULL,
    path_length INT NULL,
    path_found TINYINT(1) NULL,
    execution_time_ms FLOAT NOT NULL,
    memory_kb FLOAT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_algorithm (algorithm),
    INDEX idx_category (category),
    INDEX idx_created_at (created_at)
);
"""

# Columns that must exist for pathfinding benchmarking to work, added here
# for databases created before that feature existed (Phase 9 extension).
# Standard MySQL does NOT support "ADD COLUMN IF NOT EXISTS" (that's a
# MariaDB-ism), so we check information_schema first and only add what's
# actually missing.
REQUIRED_COLUMNS = {
    "category": "VARCHAR(20) NOT NULL DEFAULT 'sorting'",
    "visited_count": "INT NULL",
    "path_length": "INT NULL",
    "path_found": "TINYINT(1) NULL",
}


def _existing_columns(cursor):
    cursor.execute(
        """SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'benchmarks'""",
        (Config.DB_NAME,)
    )
    return {row[0] for row in cursor.fetchall()}


def _has_index(cursor, index_name):
    cursor.execute(
        """SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'benchmarks' AND INDEX_NAME = %s""",
        (Config.DB_NAME, index_name)
    )
    return cursor.fetchone()[0] > 0


def init_db():
    """
    Create the benchmarks table if it doesn't exist yet, and apply any
    pending migrations for existing installs (adding pathfinding-related
    columns to a database that only has the original sorting-only
    schema from Phase 8). Called once at app startup. Failures are
    logged but don't crash the app -- the rest of PathFinder doesn't
    depend on MySQL, so a misconfigured DB shouldn't take down the
    whole backend.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(CREATE_BENCHMARKS_TABLE)
        conn.commit()

        existing = _existing_columns(cursor)
        for column, definition in REQUIRED_COLUMNS.items():
            if column not in existing:
                cursor.execute(f"ALTER TABLE benchmarks ADD COLUMN {column} {definition};")
                print(f"[db] Migrated: added column '{column}' to benchmarks table.")

        # comparisons/swaps were NOT NULL in the original Phase-8 schema;
        # pathfinding rows need to leave them NULL.
        cursor.execute("ALTER TABLE benchmarks MODIFY COLUMN comparisons INT NULL;")
        cursor.execute("ALTER TABLE benchmarks MODIFY COLUMN swaps INT NULL;")

        if not _has_index(cursor, "idx_category"):
            cursor.execute("ALTER TABLE benchmarks ADD INDEX idx_category (category);")
            print("[db] Migrated: added index idx_category.")

        conn.commit()
        cursor.close()
        conn.close()
        print("[db] Connected to MySQL and verified 'benchmarks' table (sorting + pathfinding).")
    except MySQLError as e:
        print(f"[db] WARNING: could not connect to MySQL ({e}). "
              f"Benchmark Mode will be unavailable until this is fixed.")