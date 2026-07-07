export class WiFiConnection {
  begin(ssid: string, password?: string): void {}
  status(): number { return 0; }
  localIP(): string { return ""; }
  disconnect(): void {}
}
