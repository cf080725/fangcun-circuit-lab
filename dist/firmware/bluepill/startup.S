.syntax unified
.cpu cortex-m3
.thumb

.section .isr_vector, "a", %progbits
.balign 256
.word _estack
.word Reset_Handler
.word Default_Handler       /* NMI */
.word Default_Handler       /* HardFault */
.word Default_Handler       /* MemManage */
.word Default_Handler       /* BusFault */
.word Default_Handler       /* UsageFault */
.word 0, 0, 0, 0
.word Default_Handler       /* SVCall */
.word Default_Handler       /* DebugMonitor */
.word 0
.word Default_Handler       /* PendSV */
.word SysTick_Handler
.rept 43                     /* STM32F103 中容量型号的外部中断槽 */
.word Default_Handler
.endr

.section .text.Reset_Handler, "ax", %progbits
.global Reset_Handler
.type Reset_Handler, %function
.thumb_func
Reset_Handler:
    /* 先把 Flash 中的初值复制到 SRAM 中的 .data。 */
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

    /* 清零 .bss，然后进入 C 程序。 */
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

.weak SysTick_Handler
.thumb_set SysTick_Handler, Default_Handler

.section .note.GNU-stack, "", %progbits
