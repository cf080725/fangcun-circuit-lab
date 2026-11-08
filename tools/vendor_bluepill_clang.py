"""Repackage verified npm archives for the Blue Pill's freestanding C compiler."""

import argparse
import base64
import gzip
import hashlib
import io
from pathlib import Path
import tarfile


CLANG_SHA512 = '7T7Yh24xpH2p9iq1s+9m9ep+Igo5r/qtuwLWWSpFtdBG+4QiamxK+hRTPJSUYI4km9Y46j5lllqOMpahKbYjsQ=='
RUNTIME_SHA512 = 'NX7uK0sm5yXCTUD2O7KzyocwNEtQnloCGjPWYX8Cs6OXIA8Y3rgnkwfH6krvryqYFkSuBfJ3fLrKmxopwLOQFw=='
GEN = 'package/gen/'
RESOURCE_PREFIX = 'lib/clang/21/include'


def verified_archive(path, expected):
    archive = path.read_bytes()
    digest = base64.b64encode(hashlib.sha512(archive).digest()).decode('ascii')
    if digest != expected:
        raise ValueError(f'Unexpected npm archive SHA-512: {path}')
    return tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz')


def read_member(archive, name):
    return archive.extractfile(name).read()


def builtin_headers(resources, original):
    # Keep original headers. YoWASP's tar reader expects directory names
    # without the trailing slash that Python's standard tar writer adds.
    contents = bytearray()
    for entry in resources:
        if entry.name in ('lib', 'lib/clang', 'lib/clang/21', RESOURCE_PREFIX) or entry.name.startswith(RESOURCE_PREFIX + '/'):
            end = entry.offset_data + ((entry.size + 511) // 512) * 512
            contents.extend(original[entry.offset:end])
    contents.extend(bytes(1024))
    return gzip.compress(contents, compresslevel=9, mtime=0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('clang', type=Path, help='microbit-clang-wasm@21.11.0-alpha.1 npm archive')
    parser.add_argument('runtime', type=Path, help='@yowasp/runtime@11.0.67 npm archive')
    args = parser.parse_args()
    destination = Path(__file__).resolve().parents[1] / 'dist/vendor/bluepill-clang'
    destination.mkdir(parents=True, exist_ok=True)
    with verified_archive(args.clang, CLANG_SHA512) as clang, verified_archive(args.runtime, RUNTIME_SHA512) as runtime:
        for name in ('bundle.js', 'llvm.core2.wasm', 'llvm.core3.wasm', 'llvm.core4.wasm'):
            (destination / name).write_bytes(read_member(clang, GEN + name))
        wasm = read_member(clang, GEN + 'llvm.core.wasm')
        (destination / 'llvm.core.gzip.bin').write_bytes(gzip.compress(wasm, compresslevel=9, mtime=0))
        original = read_member(clang, GEN + 'llvm-resources.tar')
        with tarfile.open(fileobj=io.BytesIO(original)) as resources:
            (destination / 'llvm-freestanding-headers.gzip.bin').write_bytes(builtin_headers(resources, original))
            (destination / 'LLVM-LICENSE.txt').write_bytes(read_member(resources, 'share/licenses/LLVM-LICENSE.txt'))
            (destination / 'CLANG-LICENSE.txt').write_bytes(read_member(resources, 'share/licenses/CLANG-LICENSE.txt'))
            (destination / 'LLD-LICENSE.txt').write_bytes(read_member(resources, 'share/licenses/LLD-LICENSE.txt'))
        (destination / 'YoWASP-LICENSE.txt').write_bytes(read_member(runtime, 'package/LICENSE.txt'))
        for name in ('LICENSE.txt', 'LICENSES'):
            (destination / name).write_bytes(read_member(clang, 'package/' + name))


if __name__ == '__main__':
    main()
