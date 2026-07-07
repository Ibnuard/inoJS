export class SDCard {
  constructor(public readonly chipSelectPin = 10) {}
  begin(pin?: number): boolean { return false; }
  exists(path: string): boolean { return false; }
  remove(path: string): void {}
}
