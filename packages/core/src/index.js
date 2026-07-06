export class Pin {
  constructor(pinNumber) {
    this.pinNumber = pinNumber;
  }

  output() {}
  input() {}
  high() {}
  low() {}
  toggle() {}
  read() {
    return false;
  }
  write() {}
}

export class SerialPort {
  begin() {}
  print() {}
  println() {}
}

export class Ino {
  constructor() {}

  setup() {}
  loop() {}
  pin(pinNumber) {
    return new Pin(pinNumber);
  }
  serial() {
    return new SerialPort();
  }
  delay() {}
  millis() {
    return 0;
  }
}

export { Ino as Board, Ino as Core };

export function init() {
  return new Ino();
}
