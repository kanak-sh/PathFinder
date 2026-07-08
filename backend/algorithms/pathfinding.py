"""
Pathfinding algorithms over a 2D grid, with step-by-step history for
frontend animation.

Grid convention:
- grid[r][c] == 1  -> wall (blocked)
- grid[r][c] == 0  -> open (walkable)
- Movement is 8-directional. Straight moves cost 1, diagonal moves cost
  sqrt(2). Diagonal moves are disallowed if they would "cut the corner"
  between two walls (a common, realistic pathfinding rule).

Step format:
{
    "type": "frontier" | "visit" | "path" | "done" | "not_found",
    "node": [r, c],        # present for "frontier" and "visit" steps
    "path": [[r,c], ...]   # present for "path" step (empty if none found)
}
"""

import heapq
import math
import time

SQRT2 = math.sqrt(2)

DIRECTIONS = [
    (-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1),          # straight
    (-1, -1, SQRT2), (-1, 1, SQRT2), (1, -1, SQRT2), (1, 1, SQRT2)  # diagonal
]


def _in_bounds(r, c, rows, cols):
    return 0 <= r < rows and 0 <= c < cols


def _neighbors(r, c, grid, rows, cols):
    """Yield (nr, nc, cost) for valid, walkable neighbors, preventing
    diagonal moves that would cut through a wall corner."""
    for dr, dc, cost in DIRECTIONS:
        nr, nc = r + dr, c + dc
        if not _in_bounds(nr, nc, rows, cols):
            continue
        if grid[nr][nc] == 1:
            continue
        if dr != 0 and dc != 0:
            # diagonal move: both orthogonal neighbors must be open
            if grid[r + dr][c] == 1 or grid[r][c + dc] == 1:
                continue
        yield nr, nc, cost


def _reconstruct_path(parent, end):
    path = []
    node = end
    while node is not None:
        path.append(list(node))
        node = parent.get(node)
    path.reverse()
    return path


def _finalize(steps, parent, start, end, found, start_time):
    if found:
        path = _reconstruct_path(parent, end)
        steps.append({"type": "path", "path": path})
    else:
        steps.append({"type": "not_found", "path": []})

    end_time = time.perf_counter()
    return {
        "steps": steps,
        "path_found": found,
        "path_length": len(_reconstruct_path(parent, end)) if found else 0,
        "visited_count": sum(1 for s in steps if s["type"] == "visit"),
        "execution_time_ms": round((end_time - start_time) * 1000, 3)
    }


def bfs(grid, start, end):
    """Breadth-first search. Ignores cost -- finds the path with the
    fewest steps, not necessarily the geometrically shortest one."""
    start, end = tuple(start), tuple(end)
    rows, cols = len(grid), len(grid[0])
    steps = []
    start_time = time.perf_counter()

    from collections import deque
    frontier = deque([start])
    visited = {start}
    parent = {start: None}

    found = False
    while frontier:
        node = frontier.popleft()
        steps.append({"type": "visit", "node": list(node)})

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
                steps.append({"type": "frontier", "node": [nr, nc]})

    return _finalize(steps, parent, start, end, found, start_time)


def dfs(grid, start, end):
    """Depth-first search. Explores as far as possible before backtracking.
    Does NOT guarantee the shortest path."""
    start, end = tuple(start), tuple(end)
    rows, cols = len(grid), len(grid[0])
    steps = []
    start_time = time.perf_counter()

    stack = [start]
    visited = {start}
    parent = {start: None}

    found = False
    while stack:
        node = stack.pop()
        steps.append({"type": "visit", "node": list(node)})

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
                steps.append({"type": "frontier", "node": [nr, nc]})

    return _finalize(steps, parent, start, end, found, start_time)


def dijkstra(grid, start, end):
    """Dijkstra's algorithm. Explores by cumulative path cost, guaranteeing
    the shortest-cost path (accounting for cheaper straight moves vs
    pricier diagonal moves)."""
    start, end = tuple(start), tuple(end)
    rows, cols = len(grid), len(grid[0])
    steps = []
    start_time = time.perf_counter()

    dist = {start: 0}
    parent = {start: None}
    visited = set()
    heap = [(0, start)]
    frontier_seen = {start}

    found = False
    while heap:
        d, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        steps.append({"type": "visit", "node": list(node)})

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
                if neighbor not in frontier_seen:
                    frontier_seen.add(neighbor)
                    steps.append({"type": "frontier", "node": [nr, nc]})

    return _finalize(steps, parent, start, end, found, start_time)


def _octile_heuristic(a, b):
    """Admissible heuristic for 8-directional movement with diagonal cost sqrt(2)."""
    dx = abs(a[0] - b[0])
    dy = abs(a[1] - b[1])
    return max(dx, dy) + (SQRT2 - 1) * min(dx, dy)


def astar(grid, start, end):
    """A* search. Like Dijkstra, but guided toward the goal by a heuristic,
    so it typically explores far fewer nodes while still guaranteeing the
    shortest-cost path."""
    start, end = tuple(start), tuple(end)
    rows, cols = len(grid), len(grid[0])
    steps = []
    start_time = time.perf_counter()

    g_score = {start: 0}
    parent = {start: None}
    visited = set()
    heap = [(_octile_heuristic(start, end), start)]
    frontier_seen = {start}

    found = False
    while heap:
        _f, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        steps.append({"type": "visit", "node": list(node)})

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
                f_score = tentative_g + _octile_heuristic(neighbor, end)
                heapq.heappush(heap, (f_score, neighbor))
                if neighbor not in frontier_seen:
                    frontier_seen.add(neighbor)
                    steps.append({"type": "frontier", "node": [nr, nc]})

    return _finalize(steps, parent, start, end, found, start_time)


def greedy_best_first(grid, start, end):
    """Greedy Best-First Search. Always moves toward the node that looks
    closest to the goal by heuristic alone, ignoring cost so far. Fast,
    but does NOT guarantee the shortest path."""
    start, end = tuple(start), tuple(end)
    rows, cols = len(grid), len(grid[0])
    steps = []
    start_time = time.perf_counter()

    parent = {start: None}
    visited = set()
    heap = [(_octile_heuristic(start, end), start)]
    frontier_seen = {start}

    found = False
    while heap:
        _h, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        steps.append({"type": "visit", "node": list(node)})

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
            heapq.heappush(heap, (_octile_heuristic(neighbor, end), neighbor))
            steps.append({"type": "frontier", "node": [nr, nc]})

    return _finalize(steps, parent, start, end, found, start_time)


# Registry so the API route can look up an algorithm by name.
ALGORITHMS = {
    "bfs": bfs,
    "dfs": dfs,
    "dijkstra": dijkstra,
    "astar": astar,
    "greedy": greedy_best_first,
}
