FROM rust:slim-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates python3 && rm -rf /var/lib/apt/lists/*
RUN rustup target add wasm32-unknown-unknown && cargo install wasm-pack --version 0.15.0 --locked
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY web ./web
COPY site ./site
COPY artwork/catan ./artwork/catan
COPY scripts/build_web.py ./scripts/build_web.py
RUN cargo build -p table-server --release --locked && python3 scripts/build_web.py
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --system --uid 10001 table
WORKDIR /app
COPY --from=build /app/target/release/table-server /usr/local/bin/table-server
COPY --from=build /app/web ./web
USER table
ENV BIND_ADDR=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["table-server"]
