# inoJS

Modern embedded development platform for writing Arduino firmware with JavaScript or TypeScript, then generating native Arduino C++ for PlatformIO.

This repository currently contains the first MVP slice:

- pnpm monorepo
- TypeScript compiler packages
- Babel-based JS/TS parser
- Arduino C++ generator
- PlatformIO project generator
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
- `const serial = core.serial()`
- `serial.begin(115200)`
- `serial.print(...)`
- `serial.println(...)`
- `core.delay(ms)`
- `core.millis()`
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
```

## Next Compiler Steps

1. Add diagnostics with source locations.
2. Support `pin.read()` as an expression.
3. Add analog I/O APIs.
4. Introduce a plugin contribution model for includes, globals, setup, loop, dependencies, and diagnostics.
5. Add a test suite for JS/TS input to generated C++ snapshots.
