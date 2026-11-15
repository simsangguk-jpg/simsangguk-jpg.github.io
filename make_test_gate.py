#!/usr/bin/env python3
"""가족포털 테스트용 gate/db 초기화 스크립트 (테스트 코드 test1234)."""
import base64, json, os, sys, urllib.request, uuid
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

BASE = 'https://textdb.dev/api/data/'
GATE = sys.argv[1] if len(sys.argv) > 1 else 'fam-9test-gate'
CODE = sys.argv[2] if len(sys.argv) > 2 else 'test1234'


def b64(b):
    return base64.b64encode(b).decode()


def put(key, body):
    req = urllib.request.Request(BASE + key, data=body.encode(),
                                 headers={'Content-Type': 'text/plain'}, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r:
        print(key, '->', r.status)


salt = os.urandom(16)
iv = os.urandom(12)
kdf = PBKDF2HMAC(algorithm=SHA256(), length=32, salt=salt, iterations=200000)
dk = kdf.derive(CODE.encode())
master = os.urandom(32)
ct = AESGCM(dk).encrypt(iv, master, None)
gate = {'v': 1, 'iter': 200000,
        'wraps': [{'s': b64(salt), 'i': b64(iv), 'c': b64(ct)}]}
put(GATE, json.dumps(gate))
print('gate ready for code:', CODE)
