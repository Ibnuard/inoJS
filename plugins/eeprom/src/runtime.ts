export class EEPROMStore {
  begin(size?: number): void {}
  read(address: number): number { return 0; }
  write(address: number, value: number): void {}
  commit(): void {}
}
