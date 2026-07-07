export class Bluetooth {
  constructor(public readonly name = "inoJS") {}
  begin(name?: string): void {}
  available(): number { return 0; }
  read(): number { return 0; }
  print(value: string | number | boolean): void {}
  println(value: string | number | boolean): void {}
}
