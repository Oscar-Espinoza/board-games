"""Compare actual native / WASI component execution with checked-in golden bytes."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
commands = [
    [str(root / 'target/debug/color-match-replay')],
    ['wasmtime', str(root / 'target/wasm32-wasip2/debug/color-match-replay.wasm')],
]
for fixture in sorted((root / 'tests/fixtures/v2').glob('*.replay.json')):
    expected = fixture.with_name(fixture.name.replace('.replay.', '.expected.')).read_bytes()
    for command in commands:
        result = subprocess.run(command, input=fixture.read_bytes(), capture_output=True, check=True)
        assert result.stdout == expected, f'{fixture.name}: output differs for {command[0]}'
    print(f'{fixture.name}: native = WASI component = golden')

valid = json.loads(next((root / 'tests/fixtures/v2').glob('*.replay.json')).read_text())
incompatible = dict(valid, version=999)
illegal = dict(valid, actions=[{'player': 1, 'action': {'type': 'draw'}}])
historical = (root / 'tests/fixtures/seed-07.replay.json').read_bytes()
for payload in [historical, b'{', json.dumps(incompatible).encode(), json.dumps(illegal).encode(), b'{}']:
    for command in commands:
        result = subprocess.run(command, input=payload, capture_output=True)
        assert result.returncode != 0, f'{command[0]} accepted invalid input'
        assert not result.stdout, 'Invalid input must not produce a partial successful result'
        assert b'replay error:' in result.stderr
print('Native and WASI reject malformed, incomplete, incompatible, and illegal input')
