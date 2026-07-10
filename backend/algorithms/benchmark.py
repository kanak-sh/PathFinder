"""
Lightweight sorting implementations for Benchmark Mode.

These are deliberately separate from algorithms/sorting.py: the
step-tracked versions build a full history of every comparison and
swap for animation, which would badly skew both execution time and
memory measurements at benchmark scale (thousands of elements). These
versions just sort and count.
"""

import time
import tracemalloc


def _bubble(array):
    comparisons = swaps = 0
    n = len(array)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            comparisons += 1
            if array[j] > array[j + 1]:
                array[j], array[j + 1] = array[j + 1], array[j]
                swaps += 1
                swapped = True
        if not swapped:
            break
    return comparisons, swaps


def _selection(array):
    comparisons = swaps = 0
    n = len(array)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            comparisons += 1
            if array[j] < array[min_idx]:
                min_idx = j
        if min_idx != i:
            array[i], array[min_idx] = array[min_idx], array[i]
            swaps += 1
    return comparisons, swaps


def _insertion(array):
    comparisons = swaps = 0
    n = len(array)
    for i in range(1, n):
        key = array[i]
        j = i - 1
        while j >= 0:
            comparisons += 1
            if array[j] > key:
                array[j + 1] = array[j]
                swaps += 1
                j -= 1
            else:
                break
        array[j + 1] = key
    return comparisons, swaps


def _merge(array):
    counters = {"comparisons": 0, "swaps": 0}

    def merge(lo, mid, hi):
        left = array[lo:mid + 1]
        right = array[mid + 1:hi + 1]
        i = j = 0
        k = lo
        while i < len(left) and j < len(right):
            counters["comparisons"] += 1
            if left[i] <= right[j]:
                array[k] = left[i]
                i += 1
            else:
                array[k] = right[j]
                j += 1
            counters["swaps"] += 1
            k += 1
        while i < len(left):
            array[k] = left[i]
            i += 1
            k += 1
        while j < len(right):
            array[k] = right[j]
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
    return counters["comparisons"], counters["swaps"]


def _quick(array):
    counters = {"comparisons": 0, "swaps": 0}

    def partition(lo, hi):
        pivot = array[hi]
        i = lo - 1
        for j in range(lo, hi):
            counters["comparisons"] += 1
            if array[j] <= pivot:
                i += 1
                array[i], array[j] = array[j], array[i]
                counters["swaps"] += 1
        array[i + 1], array[hi] = array[hi], array[i + 1]
        counters["swaps"] += 1
        return i + 1

    def sort(lo, hi):
        if lo < hi:
            p = partition(lo, hi)
            sort(lo, p - 1)
            sort(p + 1, hi)

    sort(0, len(array) - 1)
    return counters["comparisons"], counters["swaps"]


def _heap(array):
    comparisons = swaps = 0
    n = len(array)

    def heapify(size, root):
        nonlocal comparisons, swaps
        largest = root
        left = 2 * root + 1
        right = 2 * root + 2
        if left < size:
            comparisons += 1
            if array[left] > array[largest]:
                largest = left
        if right < size:
            comparisons += 1
            if array[right] > array[largest]:
                largest = right
        if largest != root:
            array[root], array[largest] = array[largest], array[root]
            swaps += 1
            heapify(size, largest)

    for i in range(n // 2 - 1, -1, -1):
        heapify(n, i)
    for i in range(n - 1, 0, -1):
        array[0], array[i] = array[i], array[0]
        swaps += 1
        heapify(i, 0)

    return comparisons, swaps


BENCHMARK_ALGORITHMS = {
    "bubble": _bubble,
    "selection": _selection,
    "insertion": _insertion,
    "merge": _merge,
    "quick": _quick,
    "heap": _heap,
}


def run_benchmark(algorithm, array):
    """
    Runs the given algorithm on a copy of array, measuring wall-clock
    time and peak memory (via tracemalloc). Returns a result dict ready
    to store in MySQL.
    """
    if algorithm not in BENCHMARK_ALGORITHMS:
        raise ValueError(f"Unknown algorithm '{algorithm}'")

    working_array = array.copy()
    sort_fn = BENCHMARK_ALGORITHMS[algorithm]

    tracemalloc.start()
    start_time = time.perf_counter()

    comparisons, swaps = sort_fn(working_array)

    end_time = time.perf_counter()
    _current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    assert working_array == sorted(array), "benchmark produced an incorrect sort"

    return {
        "comparisons": comparisons,
        "swaps": swaps,
        "execution_time_ms": round((end_time - start_time) * 1000, 4),
        "memory_kb": round(peak / 1024, 3),
    }
