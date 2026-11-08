.syntax unified
.cpu cortex-m0plus
.thumb

.section .vectors, "a", %progbits
.balign 256
.word _estack
.word Reset_Handler
.word Default_Handler       /* NMI */
.word Default_Handler       /* HardFault */
.word 0, 0, 0, 0, 0, 0, 0
.word Default_Handler       /* SVCall */
.word 0, 0
.word Default_Handler       /* PendSV */
.word Default_Handler       /* SysTick */
.rept 32                    /* RP2040 的外部中断槽 */
.word Default_Handler
.endr

.section .text.Reset_Handler, "ax", %progbits
.global Reset_Handler
.type Reset_Handler, %function
.thumb_func
Reset_Handler:
    /* boot2 将控制权交给 XIP 中的程序。指明本程序的向量表。 */
    ldr r0, =0xE000ED08
    ldr r1, =_vectors
    str r1, [r0]

    ldr r0, =_sidata
    ldr r1, =_sdata
    ldr r2, =_edata
1:  cmp r1, r2
    bhs 2f
    ldr r3, [r0]
    str r3, [r1]
    adds r0, #4
    adds r1, #4
    b 1b

2:  ldr r1, =_sbss
    ldr r2, =_ebss
    movs r3, #0
3:  cmp r1, r2
    bhs 4f
    str r3, [r1]
    adds r1, #4
    b 3b
4:  bl main
    b Default_Handler
.size Reset_Handler, . - Reset_Handler

.section .text.Default_Handler, "ax", %progbits
.type Default_Handler, %function
.thumb_func
Default_Handler:
    b Default_Handler
.size Default_Handler, . - Default_Handler

.section .note.GNU-stack, "", %progbits
