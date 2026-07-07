export interface RegistryModule {
  name: string;
  packageName: string;
  importName: string;
}

export const officialModules: RegistryModule[] = [
  { name: "Bluetooth", packageName: "@inojs/bluetooth", importName: "Bluetooth" },
  { name: "DHT", packageName: "@inojs/dht", importName: "DHT" },
  { name: "EEPROM", packageName: "@inojs/eeprom", importName: "EEPROMStore" },
  { name: "LCD", packageName: "@inojs/lcd", importName: "LCD" },
  { name: "MQTT", packageName: "@inojs/mqtt", importName: "MQTT" },
  { name: "NeoPixel", packageName: "@inojs/neopixel", importName: "NeoPixel" },
  { name: "OLED", packageName: "@inojs/oled", importName: "OLED" },
  { name: "SD", packageName: "@inojs/sd", importName: "SDCard" },
  { name: "Servo", packageName: "@inojs/servo", importName: "Servo" },
  { name: "WiFi", packageName: "@inojs/wifi", importName: "WiFiConnection" }
];

export function findOfficialModule(name: string): RegistryModule | undefined {
  const query = name.toLowerCase();
  return officialModules.find((module) => module.name.toLowerCase() === query || module.packageName === name);
}
