# inoJS Modules

Official modules:

- `@inojs/bluetooth`
- `@inojs/dht`
- `@inojs/eeprom`
- `@inojs/lcd`
- `@inojs/mqtt`
- `@inojs/neopixel`
- `@inojs/oled`
- `@inojs/sd`
- `@inojs/servo`
- `@inojs/wifi`

Install with `ino add <name>`, then import the class from the package.

## Board Capabilities

inoJS validates module requirements during compilation. If a module needs a
board feature that the configured board does not provide, the CLI reports an
error before PlatformIO runs.

| Module | Import | Requires | Good starting board |
| --- | --- | --- | --- |
| Bluetooth | `@inojs/bluetooth` | Bluetooth | `esp32dev` |
| DHT | `@inojs/dht` | Digital pin | `uno`, `esp32dev` |
| EEPROM | `@inojs/eeprom` | EEPROM | `uno`, `esp32dev` |
| LCD | `@inojs/lcd` | I2C | `uno`, `esp32dev` |
| MQTT | `@inojs/mqtt` | WiFi | `esp32dev` |
| NeoPixel | `@inojs/neopixel` | Digital pin | `uno`, `esp32dev` |
| OLED | `@inojs/oled` | I2C | `uno`, `esp32dev` |
| SD | `@inojs/sd` | SPI | `uno`, `esp32dev` |
| Servo | `@inojs/servo` | Digital pin | `uno`, `esp32dev` |
| WiFi | `@inojs/wifi` | WiFi | `esp32dev` |

## Compiler Diagnostics

Unsupported module methods produce warnings and still generate annotated C++.
Board capability mismatches and required constructor argument problems produce
errors. `ino build`, `ino dev`, and `ino upload` stop after compiler errors so
PlatformIO does not run against known-bad generated firmware.
