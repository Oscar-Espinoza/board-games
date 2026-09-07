#!/usr/bin/env python3
"""Validate explicit game inputs, then publish independent content-addressed releases."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[1]
GAMES = [
    dict(id='color-match', crate='color-match-web', template='site/color-match.html',
         assets=['web/color-match/bridge.js', 'web/color-match/color-match-motion.js',
                 'web/color-match/loader.js', 'web/color-match/style.css'], table=True),
    dict(id='catan', crate='catan-web', template='site/catan.html',
         assets=['web/catan/catan-loader.js', 'web/catan/catan-presentation.js',
                 'web/catan/catan.css', 'artwork/catan/avatar-0.svg',
                 'artwork/catan/avatar-1.svg',
                 'artwork/catan/avatar-2.svg',
                 'artwork/catan/avatar-3.svg',
                 'artwork/catan/avatar-4.svg',
                 'artwork/catan/avatar-5.svg',
                 'artwork/catan/avatar-6.svg',
                 'artwork/catan/avatar-7.svg',
                 'artwork/catan/development-invention.svg',
                 'artwork/catan/development-knight.svg',
                 'artwork/catan/development-monopoly.svg',
                 'artwork/catan/development-roadbuilding.svg',
                 'artwork/catan/development-victorypoint.svg',
                 'artwork/catan/icon-0.svg',
                 'artwork/catan/icon-1.svg',
                 'artwork/catan/icon-2.svg',
                 'artwork/catan/icon-3.svg',
                 'artwork/catan/icon-4.svg',
                 'artwork/catan/terrain-0-0.svg',
                 'artwork/catan/terrain-0-1.svg',
                 'artwork/catan/terrain-1-0.svg',
                 'artwork/catan/terrain-1-1.svg',
                 'artwork/catan/terrain-2-0.svg',
                 'artwork/catan/terrain-2-1.svg',
                 'artwork/catan/terrain-3-0.svg',
                 'artwork/catan/terrain-3-1.svg',
                 'artwork/catan/terrain-4-0.svg',
                 'artwork/catan/terrain-4-1.svg',
                 'artwork/catan/terrain-5-0.svg',
                 'artwork/catan/terrain-5-1.svg',
                 'artwork/catan/terrain-atlas.svg'], table=True),
]
SHARED = ['web/shared/loading-shell.js']
TABLE = ['web/table/transport.js', 'web/table/table-controls.js']


def validate(games, catalog):
    ids = [game['id'] for game in games]
    if len(set(ids)) != len(ids) or set(ids) != {entry['id'] for entry in catalog}:
        raise ValueError('Build declarations must match catalog registrations exactly')
    for game in games:
        entry = next(e for e in catalog if e['id'] == game['id'])
        if entry['route'] != f"/games/{game['id']}/":
            raise ValueError(f"Unexpected catalog route: {entry['route']}")
        if game['table'] != any(m['kind'] == 'table' for m in entry['modes']):
            raise ValueError(f"Table integration mismatch: {game['id']}")
        manifest = ROOT / f"crates/{game['crate']}/Cargo.toml"
        if tomllib.loads(manifest.read_text())['package']['name'] != game['crate']:
            raise ValueError(f'Crate name mismatch: {manifest}')
        inputs = [*game['assets'], *SHARED, *(TABLE if game['table'] else [])]
        names = [Path(p).name for p in inputs]
        if len(names) != len(set(names)):
            raise ValueError(f"Duplicate release filenames: {game['id']}")
        for source in [game['template'], *inputs]:
            if not (ROOT / source).is_file():
                raise ValueError(f'Missing build input: {source}')
        template = (ROOT / game['template']).read_text()
        if '__ASSET_BASE__' not in template:
            raise ValueError(f"Missing asset placeholder: {game['template']}")
        module = game['crate'].replace('-', '_')
        release_names = {*names, f'{module}.js', f'{module}_bg.wasm'}
        if game['table']:
            release_names.add('protocol.js')
        for reference in re.findall(r'__ASSET_BASE__/([^\s"\'<>]+)', template):
            if reference not in release_names:
                raise ValueError(f'Unknown template release file: {reference}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', choices=[g['id'] for g in GAMES])
    parser.add_argument('--fixtures', action='store_true')
    parser.add_argument('--validate', action='store_true')
    args = parser.parse_args()
    catalog = json.loads(subprocess.check_output(
        ['cargo', 'run', '-q', '-p', 'game-catalog', '--example', 'export-catalog', '--locked'], cwd=ROOT))
    validate(GAMES, catalog)
    subprocess.run(['cargo', 'test', '-q', '-p', 'game-catalog', '--locked'], cwd=ROOT, check=True)
    if args.validate:
        return
    output = ROOT / ('target/browser-test-site' if args.fixtures else 'web')
    if args.fixtures:
        output.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / 'web/index.html', output / 'index.html')
        shutil.copytree(ROOT / 'web/catalog', output / 'catalog', dirs_exist_ok=True)
    games = [g for g in GAMES if not args.game or g['id'] == args.game]
    protocol = None
    if any(g['table'] for g in games):
        protocol = subprocess.check_output(['cargo', 'run', '-q', '-p', 'table-protocol', '--example', 'export-browser', '--locked'], cwd=ROOT)
    for game in games:
        with tempfile.TemporaryDirectory(prefix='board-games-build-') as temporary:
            package = Path(temporary) / 'pkg'
            command = ['wasm-pack', 'build', f"crates/{game['crate']}", '--target', 'web',
                       '--out-dir', str(package), '--release', '--locked']
            if args.fixtures:
                command += ['--features', 'fixtures']
            subprocess.run(command, cwd=ROOT, check=True)
            if game['table']:
                (package / 'protocol.js').write_bytes(protocol)
            for source in [*game['assets'], *SHARED, *(TABLE if game['table'] else [])]:
                shutil.copyfile(ROOT / source, package / Path(source).name)
            digest = hashlib.sha256()
            for file in sorted(package.iterdir()):
                if file.is_file():
                    digest.update(file.name.encode())
                    digest.update(file.read_bytes())
            version = digest.hexdigest()[:20]
            asset_base = f"/assets/{game['id']}/{version}"
            destination = output / asset_base.lstrip('/')
            if not destination.exists():
                destination.parent.mkdir(parents=True, exist_ok=True)
                staging = Path(tempfile.mkdtemp(prefix='.staging-', dir=destination.parent))
                shutil.copytree(package, staging, dirs_exist_ok=True)
                staging.rename(destination)
            entry = output / f"games/{game['id']}/index.html"
            entry.parent.mkdir(parents=True, exist_ok=True)
            temporary_entry = entry.with_suffix('.tmp')
            temporary_entry.write_text((ROOT / game['template']).read_text().replace('__ASSET_BASE__', asset_base))
            temporary_entry.replace(entry)
            print(f"Published {game['id']} assets at {asset_base}")


if __name__ == '__main__':
    main()
