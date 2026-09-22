from __future__ import annotations

import hashlib
import random
from collections.abc import MutableSequence
from typing import TypeVar

T = TypeVar("T")


def create_seeded_random(seed: str) -> random.Random:
    digest = hashlib.sha256(seed.encode()).digest()
    return random.Random(int.from_bytes(digest[:8]))


def add_to_reservoir(reservoir: list[T], value: T, seen: int, capacity: int, rng: random.Random) -> None:
    if capacity <= 0:
        return
    if len(reservoir) < capacity:
        reservoir.append(value)
        return
    replacement = rng.randrange(seen)
    if replacement < capacity:
        reservoir[replacement] = value


def shuffle_in_place(values: MutableSequence[T], rng: random.Random) -> None:
    rng.shuffle(values)
