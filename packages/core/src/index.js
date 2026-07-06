export class Pin {
  constructor(pinNumber) {
    this.pinNumber = pinNumber;
  }

  output() {}
  input() {}
  inputPullup() {}
  high() {}
  on() {}
  low() {}
  off() {}
  toggle() {}
  read() {
    return false;
  }
  write() {}
  analogRead() {
    return 0;
  }
  analogWrite() {}
  pwm() {}
}

export class SerialPort {
  begin() {}
  print() {}
  println() {}
  log() {}
}

export class Button {
  constructor(pinNumber) {
    this.pinNumber = pinNumber;
  }

  init() {}
  isPressed() {
    return false;
  }
  onPress() {}
}

export class Ino {
  constructor() {}

  init() {}
  app() {}
  setup() {}
  loop() {}
  pin(pinNumber) {
    return new Pin(pinNumber);
  }
  led(pinNumber) {
    return new Pin(pinNumber);
  }
  button(pinNumber, options) {
    return new Button(pinNumber, options);
  }
  serial() {
    return new SerialPort();
  }
  every() {}
  log() {}
  delay() {}
  millis() {
    return 0;
  }
  micros() {
    return 0;
  }
}

export { Ino as Board, Ino as Core };

export function init() {
  return new Ino();
}
