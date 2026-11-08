# Blue Pill browser C toolchain

The browser worker loads these assets from the site on the first compile. The
module and four WASM modules come from the npm release
[`microbit-clang-wasm@21.11.0-alpha.1`](https://www.npmjs.com/package/microbit-clang-wasm/v/21.11.0-alpha.1).
The package uses LLVM/Clang 21.1.1 from
[Arm Toolchain for Embedded commit `0bac08d50`](https://github.com/arm/arm-toolchain/tree/0bac08d50952133963671eeeb8c3e67695a32f49)
and [YoWASP/clang](https://codeberg.org/YoWASP/clang) packaging with
[`@yowasp/runtime@11.0.67`](https://www.npmjs.com/package/@yowasp/runtime/v/11.0.67).
The upstream package uses [jco](https://github.com/bytecodealliance/jco) 1.15.1
to produce the component adapters. Its [build source](https://github.com/carlosperate/microbit-clang-wasm)
contains the LLVM patches and build scripts.

`bundle.js` and the three small WASM adapter files are copied byte for byte.
`llvm.core.gzip.bin` contains the original `llvm.core.wasm`, compressed with
gzip. `llvm-freestanding-headers.gzip.bin` contains the original tar records for
Clang's `lib/clang/21/include` headers and their parent directories. The worker
links the laboratory's own Cortex-M3 Thumb startup and the selected Blue Pill
or NUCLEO-F103RB Flash/SRAM script. The package's micro:bit C/C++ libraries, C runtime and
compiler-rt archives are omitted.

The upstream package notice is included as [LICENSES](./LICENSES). The
compiler, linker and resource headers use Apache-2.0 with the LLVM exception.
See the [LLVM license](./LLVM-LICENSE.txt), [Clang license](./CLANG-LICENSE.txt)
and [LLD license](./LLD-LICENSE.txt). The YoWASP wrapper and runtime retain the
[ISC notice](./YoWASP-LICENSE.txt). [LICENSE.txt](./LICENSE.txt) is also copied
as supplied in the upstream npm archive.

To regenerate, fetch the two published npm archives outside the site checkout,
then run `tools/vendor_bluepill_clang.py` with their paths. The script checks
both pinned registry SHA-512 digests before writing any vendored assets.

| Runtime asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `bundle.js` | 260652 | `360573c46f4cbbeedfddc756f5a761f02514acda1bedb26ad3507b15f91cd6e9` |
| `llvm.core.gzip.bin` | 19448204 | `fb969799a29be47d5978e45caa2180eefd272cb726e557c265b067b8c729e478` |
| `llvm.core2.wasm` | 37626 | `960c326eb9b5db7aedbc169540421587a2d3f3ff987e93d6ad5b4da43430ffd4` |
| `llvm.core3.wasm` | 5458 | `63680c043192abac4700bbda6a78e4c19b139fa086b1e872d1c6915d37a428a8` |
| `llvm.core4.wasm` | 787 | `f544dc9cc46f88a0f22d1b839a4fb0853dce2d6e231d880bd19754c59a5a234d` |
| `llvm-freestanding-headers.gzip.bin` | 1032559 | `7db01d3c7242ecb4052686d4bee1a793327d0bd228f0528980492447c8c95419` |
