#!/usr/bin/env bash
set -euo pipefail

source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
sdk=$(cd -- "${1:?Provide the Pico SDK 1.5.1 directory}" && pwd)
stage2="$sdk/src/rp2_common/boot_stage2"
build=$(mktemp -d)
trap 'rm -f -- "$build/pico/version.h"; rmdir -- "$build/pico"; find "$build" -maxdepth 1 -type f -delete; rmdir -- "$build"' EXIT

mkdir "$build/pico"
sed -e 's/\${PICO_SDK_VERSION_MAJOR}/1/g' -e 's/\${PICO_SDK_VERSION_MINOR}/5/g' \
    -e 's/\${PICO_SDK_VERSION_REVISION}/1/g' -e 's/\${PICO_SDK_VERSION_STRING}/1.5.1/g' \
    "$sdk/src/common/pico_base/include/pico/version.h.in" > "$build/pico/version.h"

cpu=(-mcpu=cortex-m0plus -mthumb)
arm-none-eabi-gcc "${cpu[@]}" -nostdlib -Wl,-e,_stage2_boot,-z,noexecstack \
    -DPICO_CONFIG_HEADER=boards/pico.h -I"$build" -I"$sdk/src/boards/include" \
    -I"$sdk/src/common/pico_base/include" -I"$sdk/src/rp2_common/pico_platform/include" \
    -I"$sdk/src/rp2040/hardware_regs/include" -I"$stage2/asminclude" \
    -T "$stage2/boot_stage2.ld" "$stage2/boot2_w25q080.S" -o "$build/boot2.elf"
arm-none-eabi-objcopy -O binary "$build/boot2.elf" "$build/boot2.bin"
python3 "$stage2/pad_checksum" -s 0xffffffff "$build/boot2.bin" "$build/boot2.S"

for example in blink button adc pwm; do
    arm-none-eabi-gcc "${cpu[@]}" -std=c11 -Os -Wall -Wextra -Werror -ffreestanding \
        -fno-unwind-tables -fno-asynchronous-unwind-tables -ffunction-sections -fdata-sections \
        -nostdlib -Wl,--gc-sections,-z,noexecstack -T "$source_dir/rp2040.ld" \
        "$build/boot2.S" "$source_dir/startup.S" "$source_dir/$example.c" -o "$build/$example.elf"
    arm-none-eabi-objcopy -O binary "$build/$example.elf" "$build/$example.bin"
    arm-none-eabi-size "$build/$example.elf"

    python3 - "$build/$example.bin" "$source_dir/$example.uf2" <<'PY'
import struct
import sys
from pathlib import Path

image = Path(sys.argv[1]).read_bytes()
block_count = (len(image) + 255) // 256
with Path(sys.argv[2]).open("wb") as output:
    for index in range(block_count):
        offset = index * 256
        address = 0x10000000 + offset
        output.write(struct.pack("<8I", 0x0A324655, 0x9E5D5157, 0x2000,
                                 address, 256, index, block_count, 0xE48BFF56))
        output.write(image[offset:offset + 256].ljust(256, b"\xff"))
        output.write(bytes(220))
        output.write(struct.pack("<I", 0x0AB16F30))
PY
done
