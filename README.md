# inoJS

Modern embedded development platform for writing Arduino firmware with JavaScript or TypeScript, then generating native Arduino C++ for PlatformIO.

This repository currently contains the first MVP slice:

- pnpm monorepo
- TypeScript compiler packages
- Babel-based JS/TS parser
- Arduino C++ generator
- PlatformIO project generator
- compiler snapshot tests
- diagnostics with source line and column
- minimal plugin API
- official Servo plugin
- minimal `ino` CLI
- blink example

## Try The MVP

```bash
pnpm install
pnpm build
cd examples/blink
node ../../apps/cli/dist/src/index.js build
```

inoJS prepares the PlatformIO project internally before building. Generated build files are kept under:

```text
examples/blink/.ino/generated/
```

The current blink example:

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

Generates:

```cpp
#include <Arduino.h>

void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, !digitalRead(13));
  delay(1000);
}
```

## Supported MVP Syntax

- `import { Ino } from "@inojs/core"`
- `const core = new Ino()`
- `import { init } from "@inojs/core"`
- `const core = init()`
- `const led = core.pin(13)`
- `core.setup(() => {})`
- `core.loop(() => {})`
- `led.output()`
- `led.input()`
- `led.high()`
- `led.low()`
- `led.toggle()`
- `led.write(true | false | 1 | 0)`
- `led.inputPullup()`
- `led.analogRead()`
- `led.analogWrite(value)`
- `led.pwm(value)`
- `const serial = core.serial()`
- `serial.begin(115200)`
- `serial.print(...)`
- `serial.println(...)`
- `new Ino({ serialMonitor: true, baudRate: 115200 })`
- `core.delay(ms)`
- `core.millis()`
- `core.micros()`
- simple variables, literals, binary expressions, logical expressions, unary expressions, and `if`

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

## Servo Plugin

```js
import { Ino } from "@inojs/core";
import { Servo } from "@inojs/servo";

const core = new Ino();
const arm = new Servo(9);

core.setup(() => {
  arm.attach();
});

core.loop(() => {
  arm.write(90);
});
```

The Servo plugin contributes `#include <Servo.h>`, a C++ `Servo` instance, generated method calls, and the PlatformIO library dependency.

## Next Compiler Steps

1. Improve diagnostics from warnings into blocking errors where appropriate.
2. Add board-aware pin validation.
3. Add `ino add` and `ino remove` for plugin/module installation.
4. Improve plugin discovery instead of always loading built-in plugins.
5. Add the next official plugin, likely DHT or LCD.
