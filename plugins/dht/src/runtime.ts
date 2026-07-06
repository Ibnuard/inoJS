export type DHTType = "DHT11" | "DHT12" | "DHT21" | "DHT22" | "AM2301";

export class DHT {
  constructor(public readonly pinNumber: number, public readonly type: DHTType = "DHT22") {}
  begin(): void {}
  readTemperature(): number {
    return 0;
  }
  readHumidity(): number {
    return 0;
  }
}
