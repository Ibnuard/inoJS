export type PinValue = 0 | 1 | boolean;

export interface InitOptions {
  serialMonitor?: boolean;
  baudRate?: number;
}

export class Pin {
  readonly pinNumber: number;
  constructor(pinNumber: number);
  output(): void;
  input(): void;
  high(): void;
  low(): void;
  toggle(): void;
  read(): boolean;
  write(value: PinValue): void;
}

export class SerialPort {
  begin(baudRate: number): void;
  print(value: string | number | boolean): void;
  println(value: string | number | boolean): void;
}

export class Ino {
  constructor(options?: InitOptions);
  setup(callback: () => void): void;
  loop(callback: () => void): void;
  pin(pinNumber: number): Pin;
  serial(): SerialPort;
  delay(ms: number): void;
  millis(): number;
}

export { Ino as Core };
export { Ino as Board };

export function init(options?: InitOptions): Ino;
