"""Run the room suite through a disposable loopback-only TURN relay (no provider use)."""
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time

root = Path(__file__).resolve().parent.parent
binary = os.environ.get('TURN_SERVER_BINARY') or shutil.which('turnserver')
if not binary:
    sys.exit('Install coturn or set TURN_SERVER_BINARY to a local turnserver executable.')
port = int(os.environ.get('TURN_TEST_PORT', '3479'))
username, credential = 'test', secrets.token_hex(24)
with tempfile.TemporaryDirectory(prefix='color-match-turn-') as directory:
    with open(Path(directory) / 'process.log', 'w') as log:
        process = subprocess.Popen([
            binary, '-n', '--listening-ip=127.0.0.1', '--relay-ip=127.0.0.1',
            f'--listening-port={port}', '--min-port=50000', '--max-port=50100',
            '--realm=local-test', f'--user={username}:{credential}', '--lt-cred-mech',
            '--fingerprint', '--allow-loopback-peers', '--no-tls', '--no-dtls',
            '--no-cli', '--no-multicast-peers', '--relay-threads=1',
            f'--log-file={directory}/turn.log', f'--pidfile={directory}/turn.pid',
            f'--userdb={directory}/turn.sqlite',
        ], stdout=log, stderr=log)
        try:
            for _ in range(50):
                if process.poll() is not None:
                    sys.exit('Local TURN could not start; check binary dependencies and ports.')
                try:
                    with socket.create_connection(('127.0.0.1', port), timeout=0.1):
                        break
                except OSError:
                    time.sleep(0.1)
            else:
                sys.exit('Local TURN did not become ready.')
            env = dict(os.environ, LOCAL_TURN_TEST='true', TEST_RELAY='1')
            env['LOCAL_ICE_SERVERS'] = json.dumps([{
                'urls': [f'turn:127.0.0.1:{port}?transport=udp'],
                'username': username, 'credential': credential,
            }])
            result = subprocess.run([
                'pnpm', 'test:e2e', 'tests/browser/rooms.spec.js', '--workers=2',
                *sys.argv[1:],
            ], cwd=root, env=env)
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
    sys.exit(result.returncode)
