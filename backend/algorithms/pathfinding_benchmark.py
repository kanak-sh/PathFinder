"""
Lightweight pathfinding implementations for Benchmark Mode -- mirrors
the relationship between algorithms/sorting.py (animated) and
algorithms/benchmark.py (lightweight): these skip step-tracking so
timing and memory measurements reflect the algorithm itself, not
animation bookkeeping. Same movement rules as algorithms/pathfinding.py
(8-directional, diagonal cost sqrt(2), no cutting through wall corners).
"""

import heapq
import math
import random
import time
import tracemalloc

SQRT2 = math.sqrt(2)
DIRECTIONS = [
    (-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1),
    (-1, -1, SQRT2), (-1, 1, SQRT2), (1, -1, SQRT2), (1, 1, SQRT2)
]


def _is_solvable(grid, start, end):
    """Quick BFS reachability check (ignores diagonal corner-cutting nuance
    -- good enough as a fast solvability filter before running the real
    benchmark algorithm)."""
    from collections import deque
    rows, cols = len(grid), len(grid[0])
    seen = {start}
    q = deque([start])
    while q:
        node = q.popleft()
        if node == end:
            return True
        r, c = node
        for nr, nc, _cost in _neighbors(r, c, grid, rows, cols):
            if (nr, nc) not in seen:
                seen.add((nr, nc))
                q.append((nr, nc))
    return False


def generate_grid(size, variant="sparse", max_attempts=25):
    """
    Builds a size x size grid with start at (0,0) and end at
    (size-1, size-1). Retries until a solvable layout is found (denser
    presets are frequently unsolvable by pure chance) -- an unsolvable
    grid would make benchmark comparisons meaningless (near-instant,
    trivial runs). Falls back to carving a guaranteed path if random
    generation doesn't find one within max_attempts.
    """
    density = {"sparse": 0.12, "dense": 0.32, "maze": 0.28}.get(variant, 0.12)
    start, end = (0, 0), (size - 1, size - 1)

    for _ in range(max_attempts):
        grid = [[1 if random.random() < density else 0 for _ in range(size)] for _ in range(size)]
        grid[0][0] = 0
        grid[size - 1][size - 1] = 0
        if _is_solvable(grid, start, end):
            return grid

    # Fallback: carve a guaranteed straight-then-down path through
    # whatever the last generated grid was, so we always return something.
    for c in range(size):
        grid[0][c] = 0
    for r in range(size):
        grid[r][size - 1] = 0
    return grid


def _in_bounds(r, c, rows, cols):
    return 0 <= r < rows and 0 <= c < cols


def _neighbors(r, c, grid, rows, cols):
    for dr, dc, cost in DIRECTIONS:
        nr, nc = r + dr, c + dc
        if not _in_bounds(nr, nc, rows, cols) or grid[nr][nc] == 1:
            continue
        if dr != 0 and dc != 0 and (grid[r + dr][c] == 1 or grid[r][c + dc] == 1):
            continue
        yield nr, nc, cost


def _path_length(parent, end, found):
    if not found:
        return 0
    length = 0
    node = end
    while node is not None:
        length += 1
        node = parent.get(node)
    return length


def _bfs(grid, start, end):
    from collections import deque
    rows, cols = len(grid), len(grid[0])
    visited = {start}
    parent = {start: None}
    frontier = deque([start])
    visited_count = 0
    found = False

    while frontier:
        node = frontier.popleft()
        visited_count += 1
        if node == end:
            found = True
            break
        r, c = node
        for nr, nc, _cost in _neighbors(r, c, grid, rows, cols):
            neighbor = (nr, nc)
            if neighbor not in visited:
                visited.add(neighbor)
                parent[neighbor] = node
                frontier.append(neighbor)

    return visited_count, _path_length(parent, end, found), found


def _dfs(grid, start, end):
    rows, cols = len(grid), len(grid[0])
    visited = {start}
    parent = {start: None}
    stack = [start]
    visited_count = 0
    found = False

    while stack:
        node = stack.pop()
        visited_count += 1
        if node == end:
            found = True
            break
        r, c = node
        for nr, nc, _cost in _neighbors(r, c, grid, rows, cols):
            neighbor = (nr, nc)
            if neighbor not in visited:
                visited.add(neighbor)
                parent[neighbor] = node
                stack.append(neighbor)

    return visited_count, _path_length(parent, end, found), found


def _dijkstra(grid, start, end):
    rows, cols = len(grid), len(grid[0])
    dist = {start: 0}
    parent = {start: None}
    visited = set()
    heap = [(0, start)]
    visited_count = 0
    found = False

    while heap:
        d, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        visited_count += 1
        if node == end:
            found = True
            break
        r, c = node
        for nr, nc, cost in _neighbors(r, c, grid, rows, cols):
            neighbor = (nr, nc)
            if neighbor in visited:
                continue
            new_dist = d + cost
            if neighbor not in dist or new_dist < dist[neighbor]:
                dist[neighbor] = new_dist
                parent[neighbor] = node
                heapq.heappush(heap, (new_dist, neighbor))

    return visited_count, _path_length(parent, end, found), found


def _octile(a, b):
    dx, dy = abs(a[0] - b[0]), abs(a[1] - b[1])
    return max(dx, dy) + (SQRT2 - 1) * min(dx, dy)


def _astar(grid, start, end):
    rows, cols = len(grid), len(grid[0])
    g_score = {start: 0}
    parent = {start: None}
    visited = set()
    heap = [(_octile(start, end), start)]
    visited_count = 0
    found = False

    while heap:
        _f, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        visited_count += 1
        if node == end:
            found = True
            break
        r, c = node
        for nr, nc, cost in _neighbors(r, c, grid, rows, cols):
            neighbor = (nr, nc)
            if neighbor in visited:
                continue
            tentative_g = g_score[node] + cost
            if neighbor not in g_score or tentative_g < g_score[neighbor]:
                g_score[neighbor] = tentative_g
                parent[neighbor] = node
                heapq.heappush(heap, (tentative_g + _octile(neighbor, end), neighbor))

    return visited_count, _path_length(parent, end, found), found


def _greedy(grid, start, end):
    rows, cols = len(grid), len(grid[0])
    parent = {start: None}
    visited = set()
    frontier_seen = {start}
    heap = [(_octile(start, end), start)]
    visited_count = 0
    found = False

    while heap:
        _h, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        visited_count += 1
        if node == end:
            found = True
            break
        r, c = node
        for nr, nc, _cost in _neighbors(r, c, grid, rows, cols):
            neighbor = (nr, nc)
            if neighbor in visited or neighbor in frontier_seen:
                continue
            parent[neighbor] = node
            frontier_seen.add(neighbor)
            heapq.heappush(heap, (_octile(neighbor, end), neighbor))

    return visited_count, _path_length(parent, end, found), found


PATHFINDING_BENCHMARK_ALGORITHMS = {
    "bfs": _bfs,
    "dfs": _dfs,
    "dijkstra": _dijkstra,
    "astar": _astar,
    "greedy": _greedy,
}


def run_pathfinding_benchmark(algorithm, grid, start, end):
    """
    Runs the given pathfinding algorithm once, measuring wall-clock time
    and peak memory. Returns a result dict ready to store in MySQL.
    """
    if algorithm not in PATHFINDING_BENCHMARK_ALGORITHMS:
        raise ValueError(f"Unknown pathfinding algorithm '{algorithm}'")

    fn = PATHFINDING_BENCHMARK_ALGORITHMS[algorithm]

    # start/end arrive as lists (from JSON) -- convert to tuples since
    # they're used as dict keys / set members below, and lists aren't
    # hashable.
    start, end = tuple(start), tuple(end)

    tracemalloc.start()
    start_time = time.perf_counter()

    visited_count, path_length, found = fn(grid, start, end)

    end_time = time.perf_counter()
    _current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    return {
        "visited_count": visited_count,
        "path_length": path_length,
        "path_found": found,
        "execution_time_ms": round((end_time - start_time) * 1000, 4),
        "memory_kb": round(peak / 1024, 3),
    }