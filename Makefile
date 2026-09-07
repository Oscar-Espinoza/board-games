.PHONY: dev build check check-rust check-replay check-browser check-turn format check-format

dev: build
	cargo run -p table-server --locked

build:
	python3 scripts/build_web.py

check-rust:
	cargo fmt --all --check
	cargo clippy --workspace --all-targets --locked -- -D warnings
	cargo test --workspace --locked
	cargo clippy -p catan-web --target wasm32-unknown-unknown --locked -- -D warnings
	cargo clippy -p color-match-web --target wasm32-unknown-unknown --locked -- -D warnings
	cargo clippy -p catan-replay --target wasm32-wasip2 --locked -- -D warnings
	cargo clippy -p color-match-replay --target wasm32-wasip2 --locked -- -D warnings

check-replay:
	cargo build -p color-match-replay --locked
	cargo build -p color-match-replay --target wasm32-wasip2 --locked
	python3 scripts/check_replays.py
	cargo build -p catan-replay --locked
	cargo build -p catan-replay --target wasm32-wasip2 --locked
	python3 scripts/check_catan_replays.py

check-browser:
	python3 scripts/test_build_web.py
	node --experimental-vm-modules --test tests/transport/*.test.cjs
	python3 scripts/build_web.py --fixtures
	cargo build -p table-server --locked
	cargo build -p color-match-replay --locked
	cargo build -p catan-replay --locked
	pnpm test:e2e

format:
	pnpm format
	cargo fmt --all

check-format:
	pnpm format:check

check: check-format check-rust check-replay check-browser

check-turn: build
	cargo build -p table-server --locked
	python3 scripts/check_turn.py
