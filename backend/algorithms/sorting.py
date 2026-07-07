"""
Sorting algorithms that return a step-by-step history instead of just
a sorted array. Each step is a dict the frontend uses to animate and
explain the algorithm's progress.

Common step fields:
{
    "type": "compare" | "swap" | "overwrite" | "done",
    "indices": [i, j],          # array indices involved in this step
    "array": [...],             # full array state AFTER this step

    # Optional, algorithm-specific extras:
    "sorted_from": int,         # indices >= this are guaranteed sorted (bubble, heap)
    "sorted_upto": int,         # indices < this are guaranteed sorted (selection, insertion)
    "pivot": int,                # current pivot index (quick sort)
    "mid": int                   # current midpoint being merged around (merge sort)
}
"""

import time


def bubble_sort(arr):
    """Bubble sort. Sorted region grows from the end (trailing suffix)."""
    array = arr.copy()
    steps = []
    comparisons = 0
    swaps = 0

    start_time = time.perf_counter()

    n = len(array)
    for i in range(n):
        sorted_from = n - i
        for j in range(0, n - i - 1):
            comparisons += 1
            steps.append({
                "type": "compare",
                "indices": [j, j + 1],
                "array": array.copy(),
                "sorted_from": sorted_from
            })

            if array[j] > array[j + 1]:
                array[j], array[j + 1] = array[j + 1], array[j]
                swaps += 1
                steps.append({
                    "type": "swap",
                    "indices": [j, j + 1],
                    "array": array.copy(),
                    "sorted_from": sorted_from
                })

    steps.append({"type": "done", "indices": [], "array": array.copy()})
    end_time = time.perf_counter()

    return {
        "steps": steps,
        "comparisons": comparisons,
        "swaps": swaps,
        "execution_time_ms": round((end_time - start_time) * 1000, 3)
    }


def selection_sort(arr):
    """Selection sort. Sorted region grows from the front (leading prefix)."""
    array = arr.copy()
    steps = []
    comparisons = 0
    swaps = 0

    start_time = time.perf_counter()

    n = len(array)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            comparisons += 1
            steps.append({
                "type": "compare",
                "indices": [min_idx, j],
                "array": array.copy(),
                "sorted_upto": i
            })
            if array[j] < array[min_idx]:
                min_idx = j

        if min_idx != i:
            array[i], array[min_idx] = array[min_idx], array[i]
            swaps += 1
            steps.append({
                "type": "swap",
                "indices": [i, min_idx],
                "array": array.copy(),
                "sorted_upto": i + 1
            })

    steps.append({"type": "done", "indices": [], "array": array.copy()})
    end_time = time.perf_counter()

    return {
        "steps": steps,
        "comparisons": comparisons,
        "swaps": swaps,
        "execution_time_ms": round((end_time - start_time) * 1000, 3)
    }


def insertion_sort(arr):
    """Insertion sort. Sorted region grows from the front (leading prefix)."""
    array = arr.copy()
    steps = []
    comparisons = 0
    swaps = 0

    start_time = time.perf_counter()

    n = len(array)
    for i in range(1, n):
        key = array[i]
        j = i - 1
        while j >= 0:
            comparisons += 1
            steps.append({
                "type": "compare",
                "indices": [j, j + 1],
                "array": array.copy(),
                "sorted_upto": i
            })
            if array[j] > key:
                array[j + 1] = array[j]
                swaps += 1
                steps.append({
                    "type": "overwrite",
                    "indices": [j + 1],
                    "array": array.copy(),
                    "sorted_upto": i
                })
                j -= 1
            else:
                break
        array[j + 1] = key
        steps.append({
            "type": "overwrite",
            "indices": [j + 1],
            "array": array.copy(),
            "sorted_upto": i + 1
        })

    steps.append({"type": "done", "indices": [], "array": array.copy()})
    end_time = time.perf_counter()

    return {
        "steps": steps,
        "comparisons": comparisons,
        "swaps": swaps,
        "execution_time_ms": round((end_time - start_time) * 1000, 3)
    }


def merge_sort(arr):
    """Merge sort. Each step tags the current midpoint so the frontend
    can highlight it, since merge sort's 'sorted region' isn't a simple
    prefix/suffix like bubble/selection/insertion."""
    array = arr.copy()
    steps = []
    counters = {"comparisons": 0, "swaps": 0}

    start_time = time.perf_counter()

    def merge(lo, mid, hi):
        left = array[lo:mid + 1]
        right = array[mid + 1:hi + 1]
        i = j = 0
        k = lo

        while i < len(left) and j < len(right):
            counters["comparisons"] += 1
            steps.append({
                "type": "compare",
                "indices": [lo + i, mid + 1 + j],
                "array": array.copy(),
                "mid": mid
            })
            if left[i] <= right[j]:
                array[k] = left[i]
                i += 1
            else:
                array[k] = right[j]
                j += 1
            counters["swaps"] += 1
            steps.append({
                "type": "overwrite",
                "indices": [k],
                "array": array.copy(),
                "mid": mid
            })
            k += 1

        while i < len(left):
            array[k] = left[i]
            steps.append({"type": "overwrite", "indices": [k], "array": array.copy(), "mid": mid})
            i += 1
            k += 1

        while j < len(right):
            array[k] = right[j]
            steps.append({"type": "overwrite", "indices": [k], "array": array.copy(), "mid": mid})
            j += 1
            k += 1

    def sort(lo, hi):
        if lo >= hi:
            return
        mid = (lo + hi) // 2
        sort(lo, mid)
        sort(mid + 1, hi)
        merge(lo, mid, hi)

    sort(0, len(array) - 1)

    steps.append({"type": "done", "indices": [], "array": array.copy()})
    end_time = time.perf_counter()

    return {
        "steps": steps,
        "comparisons": counters["comparisons"],
        "swaps": counters["swaps"],
        "execution_time_ms": round((end_time - start_time) * 1000, 3)
    }


def quick_sort(arr):
    """Quick sort (Lomuto partition). Each step tags the current pivot
    index so the frontend can highlight it distinctly."""
    array = arr.copy()
    steps = []
    counters = {"comparisons": 0, "swaps": 0}

    start_time = time.perf_counter()

    def partition(lo, hi):
        pivot = array[hi]
        i = lo - 1
        for j in range(lo, hi):
            counters["comparisons"] += 1
            steps.append({
                "type": "compare",
                "indices": [j, hi],
                "array": array.copy(),
                "pivot": hi
            })
            if array[j] <= pivot:
                i += 1
                array[i], array[j] = array[j], array[i]
                counters["swaps"] += 1
                steps.append({
                    "type": "swap",
                    "indices": [i, j],
                    "array": array.copy(),
                    "pivot": hi
                })
        array[i + 1], array[hi] = array[hi], array[i + 1]
        counters["swaps"] += 1
        steps.append({
            "type": "swap",
            "indices": [i + 1, hi],
            "array": array.copy(),
            "pivot": hi
        })
        return i + 1

    def sort(lo, hi):
        if lo < hi:
            p = partition(lo, hi)
            sort(lo, p - 1)
            sort(p + 1, hi)

    sort(0, len(array) - 1)

    steps.append({"type": "done", "indices": [], "array": array.copy()})
    end_time = time.perf_counter()

    return {
        "steps": steps,
        "comparisons": counters["comparisons"],
        "swaps": counters["swaps"],
        "execution_time_ms": round((end_time - start_time) * 1000, 3)
    }


def heap_sort(arr):
    """Heap sort. Sorted region grows from the end during the extraction
    phase (once the max-heap has been built)."""
    array = arr.copy()
    steps = []
    comparisons = 0
    swaps = 0

    start_time = time.perf_counter()

    n = len(array)
    sorted_from = n  # nothing sorted yet during the build phase

    def heapify(size, root):
        nonlocal comparisons, swaps
        largest = root
        left = 2 * root + 1
        right = 2 * root + 2

        if left < size:
            comparisons += 1
            steps.append({"type": "compare", "indices": [largest, left], "array": array.copy(), "sorted_from": sorted_from})
            if array[left] > array[largest]:
                largest = left

        if right < size:
            comparisons += 1
            steps.append({"type": "compare", "indices": [largest, right], "array": array.copy(), "sorted_from": sorted_from})
            if array[right] > array[largest]:
                largest = right

        if largest != root:
            array[root], array[largest] = array[largest], array[root]
            swaps += 1
            steps.append({"type": "swap", "indices": [root, largest], "array": array.copy(), "sorted_from": sorted_from})
            heapify(size, largest)

    for i in range(n // 2 - 1, -1, -1):
        heapify(n, i)

    for i in range(n - 1, 0, -1):
        array[0], array[i] = array[i], array[0]
        swaps += 1
        sorted_from = i
        steps.append({"type": "swap", "indices": [0, i], "array": array.copy(), "sorted_from": sorted_from})
        heapify(i, 0)

    steps.append({"type": "done", "indices": [], "array": array.copy()})
    end_time = time.perf_counter()

    return {
        "steps": steps,
        "comparisons": comparisons,
        "swaps": swaps,
        "execution_time_ms": round((end_time - start_time) * 1000, 3)
    }


# Registry so the API route can look up an algorithm by name.
ALGORITHMS = {
    "bubble": bubble_sort,
    "selection": selection_sort,
    "insertion": insertion_sort,
    "merge": merge_sort,
    "quick": quick_sort,
    "heap": heap_sort,
}