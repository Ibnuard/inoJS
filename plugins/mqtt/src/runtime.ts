export class MQTT {
  setServer(host: string, port: number): void {}
  connect(clientId: string, user?: string, password?: string): boolean { return false; }
  publish(topic: string, payload: string): boolean { return false; }
  subscribe(topic: string): boolean { return false; }
  loop(): void {}
}
