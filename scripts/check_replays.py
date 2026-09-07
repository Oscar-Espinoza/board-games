"""Compare actual native / WASI component execution with checked-in golden bytes."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
commands = [
    [str(root / 'target/debug/color-match-replay')],
    ['wasmtime', str(root / 'target/wasm32-wasip2/debug/color-match-replay.wasm')],
]
fixture_names = ['eight', 'recycle', 'seed-07', 'seed-19']
fixtures = [root / "tests/fixtures/v2" / f"{name}.replay.json" for name in fixture_names]
for source in fixtures:
    expected = source.with_name(source.name.replace(".replay.", ".expected."))
    for required in [source, expected]:
        if not required.is_file():
            raise SystemExit(f"Missing replay input: {required}")
for fixture in fixtures:
    expected = fixture.with_name(fixture.name.replace('.replay.', '.expected.')).read_bytes()
    for command in commands:
        result = subprocess.run(command, input=fixture.read_bytes(), capture_output=True, check=True)
        if not (result.stdout == expected):
            raise SystemExit('Replay validation failed: ' + str(command))
    print(f'{fixture.name}: native = WASI component = golden')

valid = json.loads((root / 'tests/fixtures/v2/seed-07.replay.json').read_text())
incompatible = dict(valid, version=999)
illegal = dict(valid, actions=[{'player': 1, 'action': {'type': 'draw'}}])
historical = (root / 'tests/fixtures/seed-07.replay.json').read_bytes()
for payload in [historical, b'{', json.dumps(incompatible).encode(), json.dumps(illegal).encode(), b'{}']:
    for command in commands:
        result = subprocess.run(command, input=payload, capture_output=True)
        if not (result.returncode != 0):
            raise SystemExit('Replay validation failed: ' + str(command))
        if not (not result.stdout):
            raise SystemExit('Replay validation failed: ' + str(command))
        if not (b'replay error:' in result.stderr):
            raise SystemExit('Replay validation failed: ' + str(command))
print('Native and WASI reject malformed, incomplete, incompatible, and illegal input')
