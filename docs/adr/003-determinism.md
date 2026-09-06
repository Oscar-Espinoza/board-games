# ADR 003: Explicit deterministic randomness and versioned replay

Status: Accepted; version 2 introduced 2026-09-05.

Use ChaCha12 with an explicit 32-byte seed. Preserve Fisher–Yates over ascending
card IDs and rejection sampling on `u32`; do not use architecture-sized RNG
sampling or unstable convenience shuffles. Browser Web Crypto acquires entropy
outside the rules crate. Card IDs survive recycling. Invalid actions cannot
mutate canonical state, revision or RNG position.

Version 2 changes the deck, deal, ordered roster, actions, views and bot behavior.
The exact contract is [rules v2](../rules.md). It intentionally breaks replay
compatibility: reject version 1 explicitly, retain its fixtures unchanged, and
store new golden files under `tests/fixtures/v2/`. New fixtures cover two and eight
seats, action cards and stock recycling. Compare native output and actual Wasmtime
Preview 2 execution byte-for-byte against reviewed golden outputs.

Replay inputs contain a seed and full action log; outputs contain all players'
views. Both are privileged development artifacts unsuitable for guest protocols.
