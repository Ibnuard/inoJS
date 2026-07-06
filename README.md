# inoJS

Modern embedded development platform for writing Arduino firmware with JavaScript or TypeScript, then generating native Arduino C++ for PlatformIO.

inoJS is intentionally built as a **two-layer API**:

- **High-level API** for the common path: `core.init`, `core.every`, `core.log`, `core.led`, `core.button`, `serial.log`, `lcd.line`, `sensor.temperature`.
- **Low-level API** for Arduino-style control: `setup`, `loop`, `pin`, `delay`, `print`, `println`, `setCursor`, `readTemperature`, and direct library-shaped methods.

The generated firmware is still native Arduino C++. There is no JavaScript interpreter on the board.

## Try It

```bash
pnpm install
pnpm build
cd examples/blink
node ../../apps/cli/dist/src/index.js build
```

Generated PlatformIO files are written to:

```text
.ino/generated/
```

## Example Structure

Every example keeps both API layers visible:

```text
src/main.js              high-level inoJS style
src/low-level-example.js Arduino-like low-level style
```

For example, high-level blink:

```js
import { Ino } from "@inojs/core";

const core = new Ino();
const led = core.led(13);

core.init(() => {
  led.output();
});

core.every("blink", 1000, () => {
  led.toggle();
});
```

Low-level blink:

```js
import { Ino } from "@inojs/core";

const core = new Ino();
const led = core.pin(13);

core.setup(() => {
  led.output();
});

core.loop(() => {
  led.toggle();
  core.delay(1000);
});
```

Both generate native Arduino C++.

## High-Level APIs

### Core

```js
core.init(() => {});
core.app(() => {});

core.every("taskName", 1000, () => {});
core.every(1000, () => {});

core.log("Millis", core.millis());
```

`core.every` generates non-blocking `millis()` scheduling.

### LED

```js
const led = core.led(13);

led.output();
led.on();
led.off();
led.toggle();
```

### Button

```js
const button = core.button(2, { pullup: true });
const led = core.led(13);

core.init(() => {
  button.init();
  led.output();
});

button.onPress(() => {
  led.toggle();
});
```

`button.onPress` generates edge detection state in C++.

### Serial

```js
const serial = core.serial();

serial.log("Temperature: ", value);
serial.log(`Temperature: ${value}`);
```

`serial.log` prints all values and adds a newline at the end.

### LCD

```js
const lcd = new LCD(0x27, 16, 2);

core.init(() => {
  lcd.start();
  lcd.line(0, "Hello inoJS");
});

core.every("clock", 1000, () => {
  lcd.line(1, `Millis ${core.millis()}`);
});
```

`lcd.start()` initializes the display and enables the backlight. `lcd.line(row, value)` clears and rewrites one row.

### DHT

```js
const sensor = new DHT(2, "DHT22");

core.init(() => {
  sensor.begin();
});

core.every("readSensor", 2000, () => {
  serial.log(`Temperature: ${sensor.temperature()}`);
  serial.log(`Humidity: ${sensor.humidity()}`);
});
```

`temperature()` and `humidity()` are high-level aliases for the lower-level DHT reads.

## Low-Level APIs

The Arduino-shaped API remains available when you want exact control:

```js
core.setup(() => {});
core.loop(() => {});

const pin = core.pin(13);
pin.output();
pin.high();
pin.low();
pin.toggle();
pin.analogRead();
pin.pwm(value);

const serial = core.serial();
serial.begin(115200);
serial.print("Value: ");
serial.println(value);

core.delay(1000);
core.millis();
core.micros();
```

Plugin low-level methods also stay available:

```js
lcd.begin();
lcd.backlight();
lcd.setCursor(0, 1);
lcd.print("Hello");

sensor.readTemperature();
sensor.readHumidity();

servo.attach();
servo.write(90);
servo.detach();
```

## Supported Plugins

- `@inojs/servo`
- `@inojs/dht`
- `@inojs/lcd`

Plugins contribute generated C++ includes, globals, method calls, and PlatformIO library dependencies.

## Project Config

Create `ino.config.json` in an inoJS project:

```json
{
  "board": "uno",
  "monitorSpeed": 115200
}
```

`INO_BOARD=esp32dev` can be used as a temporary board override.

## CLI

```bash
ino new my-project
ino build
ino upload
ino monitor
ino doctor
ino doctor --fix
```

`ino doctor` checks PlatformIO, Python, and the VSCode CLI. If PlatformIO is missing, it can offer installation through Python/pip or the PlatformIO IDE VSCode extension.

## Current Compiler Coverage

- JavaScript and TypeScript parsing through Babel
- source diagnostics with file, line, and column
- top-level object declarations
- `init`/`setup` and `app`/`loop` lifecycles
- `every` scheduled callbacks
- basic variables and assignments
- literals, template literals, binary/logical/unary expressions
- `if` statements
- core pin, serial, button, and timing APIs
- plugin declaration/call generation
- PlatformIO dependency generation
- automated tests that compile all example `main.js` and `low-level-example.js` files

## Next Steps

1. Add debounce options for `button.onPress`.
2. Add a high-level Servo sweep helper.
3. Continue splitting generator internals by domain.
4. Improve plugin discovery beyond built-in registry.
5. Add board-aware pin validation.
