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
  inputPullup(): void;
  high(): void;
  on(): void;
  low(): void;
  off(): void;
  toggle(): void;
  read(): boolean;
  write(value: PinValue): void;
  analogRead(): number;
  analogWrite(value: number): void;
  pwm(value: number): void;
}

export class SerialPort {
  begin(baudRate: number): void;
  print(value: string | number | boolean): void;
  println(value: string | number | boolean): void;
}

export type TaskCallback = () => void;
export type LogValue = string | number | boolean;

export class Ino {
  constructor(options?: InitOptions);
  init(callback: TaskCallback): void;
  app(callback: TaskCallback): void;
  setup(callback: () => void): void;
  loop(callback: () => void): void;
  pin(pinNumber: number): Pin;
  led(pinNumber: number): Pin;
  serial(): SerialPort;
  every(ms: number, callback: TaskCallback): void;
  every(name: string, ms: number, callback: TaskCallback): void;
  log(...values: LogValue[]): void;
  delay(ms: number): void;
  millis(): number;
  micros(): number;
}

export { Ino as Core };
export { Ino as Board };

export function init(options?: InitOptions): Ino;
