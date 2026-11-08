// Pin mapping: ArduinoCore-avr 1.8.6, variants/mega/pins_arduino.h.
// Register map and vectors: Microchip ATmega640/1280/1281/2560/2561, DS40002211A.
import {
  portAConfig, portBConfig, portCConfig, portDConfig, portEConfig, portFConfig,
  portGConfig, portHConfig, portJConfig, portKConfig, portLConfig,
} from './vendor/avr8js/peripherals/gpio.js';
import {AVRTimer, timer0Config, timer1Config, timer2Config} from './vendor/avr8js/peripherals/timer.js';

const extInterrupt = index => ({
  EICR: index < 4 ? 0x69 : 0x6a, EIMSK: 0x3d, EIFR: 0x3c,
  index, iscOffset: 2 * (index % 4), interrupt: 2 * (index + 1),
});
const gpioPort = (config, externalInterrupts = []) => ({...config, externalInterrupts, pinChange: undefined});
const PORTS = {
  A: gpioPort(portAConfig), B: gpioPort(portBConfig), C: gpioPort(portCConfig),
  D: gpioPort(portDConfig, [0, 1, 2, 3].map(extInterrupt)),
  E: gpioPort(portEConfig, [null, null, null, null, ...[4, 5, 6, 7].map(extInterrupt)]),
  F: gpioPort(portFConfig), G: gpioPort(portGConfig), H: gpioPort(portHConfig),
  J: gpioPort(portJConfig), K: gpioPort(portKConfig), L: gpioPort(portLConfig),
};

const digitalPins = [
  'E0 E1 E4 E5 G5 E3 H3 H4 H5 H6 B4 B5 B6 B7 J1 J0 H1 H0 D3 D2 D1 D0',
  'A0 A1 A2 A3 A4 A5 A6 A7 C7 C6 C5 C4 C3 C2 C1 C0 D7 G2 G1 G0',
  'L7 L6 L5 L4 L3 L2 L1 L0 B3 B2 B1 B0',
].join(' ').split(' ');

export const megaGpio = [
  ...digitalPins.map(([port, bit], index) => ({name: 'D' + index, bit: Number(bit), config: PORTS[port]})),
  ...Array.from({length: 16}, (_, index) => ({
    name: 'A' + index, bit: index % 8, config: index < 8 ? PORTS.F : PORTS.K,
  })),
];

function timer16(base, captureInterrupt, TIFR, TIMSK, port, pins, clockPort, externalClockPin) {
  return {
    ...timer1Config,
    TCCRA: base, TCCRB: base + 1, TCCRC: base + 2, TCNT: base + 4, ICR: base + 6,
    OCRA: base + 8, OCRB: base + 10, OCRC: base + 12,
    captureInterrupt, compAInterrupt: captureInterrupt + 2, compBInterrupt: captureInterrupt + 4,
    compCInterrupt: captureInterrupt + 6, ovfInterrupt: captureInterrupt + 8,
    TIFR, TIMSK, OCFC: 8, OCIEC: 8,
    compPortA: port.PORT, compPortB: port.PORT, compPortC: port.PORT,
    compPinA: pins[0], compPinB: pins[1], compPinC: pins[2],
    externalClockPort: clockPort.PORT, externalClockPin,
  };
}

const megaTimers = [
  {
    ...timer0Config,
    compAInterrupt: 0x2a, compBInterrupt: 0x2c, ovfInterrupt: 0x2e,
    compPortA: PORTS.B.PORT, compPinA: 7, compPortB: PORTS.G.PORT, compPinB: 5,
    externalClockPort: PORTS.D.PORT, externalClockPin: 7,
  },
  timer16(0x80, 0x20, 0x36, 0x6f, PORTS.B, [5, 6, 7], PORTS.D, 6),
  {
    ...timer2Config,
    compAInterrupt: 0x1a, compBInterrupt: 0x1c, ovfInterrupt: 0x1e,
    compPortA: PORTS.B.PORT, compPinA: 4, compPortB: PORTS.H.PORT, compPinB: 6,
  },
  timer16(0x90, 0x3e, 0x38, 0x71, PORTS.E, [3, 4, 5], PORTS.E, 6),
  timer16(0xa0, 0x52, 0x39, 0x72, PORTS.H, [3, 4, 5], PORTS.H, 7),
  timer16(0x120, 0x5c, 0x3a, 0x73, PORTS.L, [3, 4, 5], PORTS.L, 2),
];

export function installMegaTimers(cpu) {
  for (const config of megaTimers) {
    const {OVF, OCFA, OCFB, OCFC} = new AVRTimer(cpu, config);
    const flags = config.OCRC ? [OVF, OCFA, OCFB, OCFC] : [OVF, OCFA, OCFB];
    // The AVR8js register hooks omit compare C and store writes to TIFR.
    // On Mega, compare C shares these registers and all flags are W1C.
    cpu.writeHooks[config.TIFR] = (value, _old, _address, mask) => {
      for (const flag of flags) cpu.clearInterruptByFlag(flag, value & mask);
      return true;
    };
    cpu.writeHooks[config.TIMSK] = value => {
      for (const flag of flags) cpu.updateInterruptEnable(flag, value);
    };
  }
}

function usart(base, rxCompleteInterrupt) {
  return {
    UCSRA: base, UCSRB: base + 1, UCSRC: base + 2, UBRRL: base + 4, UBRRH: base + 5, UDR: base + 6,
    rxCompleteInterrupt, dataRegisterEmptyInterrupt: rxCompleteInterrupt + 2,
    txCompleteInterrupt: rxCompleteInterrupt + 4,
  };
}

export const megaUsarts = [
  usart(0xc0, 0x32), usart(0xc8, 0x48), usart(0xd0, 0x66), usart(0x130, 0x6c),
];
