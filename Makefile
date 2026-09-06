.PHONY: dev build check check-rust check-replay check-browser check-turn

dev: build
	cargo run -p table-server --locked

build:
	wasm-pack build crates/board-games-web --target web --out-dir ../../web/pkg --release --locked

check-rust:
	cargo fmt --all --check
	cargo clippy --workspace --all-targets --locked -- -D warnings
	cargo test --workspace --locked
	cargo clippy -p board-games-web --target wasm32-unknown-unknown --locked -- -D warnings
	cargo clippy -p color-match-replay --target wasm32-wasip2 --locked -- -D warnings

check-replay:
	cargo build -p color-match-replay --locked
	cargo build -p color-match-replay --target wasm32-wasip2 --locked
	python3 scripts/check_replays.py

check-browser:
	wasm-pack build crates/board-games-web --target web --out-dir ../../web/pkg --release --locked --features fixtures
	cargo build -p table-server --locked
	cargo build -p color-match-replay --locked
	pnpm test:e2e

check: check-rust check-replay check-browser

check-turn: build
	cargo build -p table-server --locked
	python3 scripts/check_turn.py
