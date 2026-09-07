"""Compare privileged CATAN replays across native and WASI component execution."""
from pathlib import Path
import json
import subprocess
root = Path(__file__).resolve().parents[1]
commands = [[str(root / 'target/debug/catan-replay')], ['wasmtime', str(root / 'target/wasm32-wasip2/debug/catan-replay.wasm')]]
fixture_names = ['3-beginner', '3-variable', '4-beginner', '4-variable', '5-beginner', '5-variable', '6-beginner', '6-variable']
fixtures = [root / "tests/fixtures/catan" / f"{name}.replay.json" for name in fixture_names]
for source in fixtures:
    expected = source.with_name(source.name.replace(".replay.", ".expected."))
    for required in [source, expected]:
        if not required.is_file():
            raise SystemExit(f"Missing replay input: {required}")
for source in fixtures:
    expected = source.with_name(source.name.replace('.replay.json', '.expected.json')).read_bytes()
    for command in commands:
        result = subprocess.run(command, input=source.read_bytes(), capture_output=True, check=True)
        if not (result.stdout == expected):
            raise SystemExit('Replay validation failed: ' + str(command))
    print(f'{source.name}: native = WASI = golden')
valid = json.loads((root / 'tests/fixtures/catan/3-variable.replay.json').read_text())
for bad in ['{', json.dumps(dict(valid, version=999)), json.dumps(dict(valid, actions=[{'player':255,'action':{'type':'roll'}}]))]:
    for command in commands:
        result = subprocess.run(command, input=bad.encode(), capture_output=True)
        if not (result.returncode != 0 and not result.stdout):
            raise SystemExit('Replay validation failed: ' + str(command))
print('CATAN replay rejects malformed, incompatible and illegal input')
