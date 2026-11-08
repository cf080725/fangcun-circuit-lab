ENTRY(Reset_Handler)

MEMORY
{
  FLASH (rx)  : ORIGIN = 0x10000000, LENGTH = 2M
  RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 264K
}

_estack = ORIGIN(RAM) + LENGTH(RAM);

SECTIONS
{
  .boot2 : { KEEP(*(.boot2)) } > FLASH
  ASSERT(SIZEOF(.boot2) == 256, "RP2040 requires a 256-byte boot2")

  .vectors :
  {
    _vectors = .;
    KEEP(*(.vectors))
  } > FLASH
  ASSERT(ADDR(.vectors) == ORIGIN(FLASH) + 256, "RP2040 vector table must follow boot2")

  .text :
  {
    *(.text*)
    *(.rodata*)
    . = ALIGN(4);
  } > FLASH

  .ARM.exidx : { *(.ARM.exidx*) } > FLASH

  .data :
  {
    . = ALIGN(4);
    _sdata = .;
    *(.data*)
    . = ALIGN(4);
    _edata = .;
  } > RAM AT > FLASH
  _sidata = LOADADDR(.data);

  .bss (NOLOAD) :
  {
    . = ALIGN(4);
    _sbss = .;
    *(.bss*)
    *(COMMON)
    . = ALIGN(4);
    _ebss = .;
  } > RAM
}
