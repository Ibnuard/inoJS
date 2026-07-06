# inoJS

> **Modern Embedded Development Platform**
>
> Write JavaScript or TypeScript.
>
> Build native Arduino C++.
>
> Powered by PlatformIO.

---

# Vision

inoJS bertujuan menjadi platform modern untuk pengembangan firmware embedded.

Developer cukup menulis JavaScript atau TypeScript seperti membuat aplikasi Node.js, sementara inoJS akan:

- mentranspilasi source menjadi C++ Arduino
- mengelola dependency
- menghasilkan project PlatformIO
- membangun firmware
- melakukan upload
- menjalankan Serial Monitor

Tanpa perlu membuka Arduino IDE.

---

# Design Principles

## JavaScript First

Pemula cukup menggunakan JavaScript.

```js
import { init } from "@inojs/core";

const core = init();

core.setup(() => {});

core.loop(() => {});
```

---

## TypeScript Ready

Developer yang membutuhkan type safety cukup mengganti file menjadi `.ts`.

Tanpa mengubah API.

---

## Zero Arduino Knowledge

Developer tidak perlu memahami:

- setup()
- loop()
- include
- pinMode()
- digitalWrite()
- PlatformIO
- Library Manager

Semuanya dikelola inoJS.

---

## VSCode First

Semua pengalaman dikembangkan untuk VSCode.

Target pengalaman seperti:

- TypeScript
- Node.js
- Bun
- Next.js

---

## Native Performance

Firmware akhir tetap merupakan C++ native.

Tidak ada interpreter JavaScript di mikrokontroler.

---

# High Level Architecture

```text
                    User Project

        src/main.js
        src/main.ts

                │

                ▼

           ino CLI

                │

                ▼

          JavaScript Parser

                │

                ▼

               AST

                │

                ▼

         Plugin Resolver

                │

                ▼

        C++ Code Generator

                │

                ▼

        PlatformIO Generator

                │

                ▼

          PlatformIO Build

                │

                ▼

          Native Firmware

                │

                ▼

             Upload
```

---

# Monorepo Structure

```text
inojs/

apps/
│
├── cli
│
├── vscode
│
└── docs

packages/
│
├── compiler
│
├── parser
│
├── generator
│
├── core
│
├── runtime
│
├── types
│
├── config
│
├── platformio
│
├── registry
│
├── source-map
│
├── diagnostics
│
├── plugin-api
│
└── create-app

plugins/
│
├── servo
│
├── lcd
│
├── oled
│
├── wifi
│
├── mqtt
│
├── neopixel
│
├── eeprom
│
├── dht
│
└── sd

examples/
│
├── blink
├── servo
├── lcd
├── wifi
└── mqtt

templates/
│
├── basic
├── esp32
├── uno
└── nano

website/

scripts/

.github/
```

---

# Package Responsibilities

## @inojs/core

Public API.

```js
const core = init();
```

Contains

- setup()
- loop()
- pin()
- serial()
- delay()
- millis()
- micros()

---

## @inojs/compiler

Main compiler.

Responsibilities

- Parse
- Resolve imports
- Build AST
- Run plugins
- Generate C++

---

## @inojs/parser

Wrapper for Babel Parser.

Output

ESTree AST.

---

## @inojs/generator

Convert AST into

- C++
- includes
- globals
- setup()
- loop()

---

## @inojs/plugin-api

SDK for module developers.

Plugin lifecycle

- analyze()
- transform()
- generate()
- finalize()

---

## @inojs/platformio

Generate

platformio.ini

Run

- build
- upload
- monitor

---

## @inojs/source-map

Map generated C++ lines back to JS/TS.

Compiler errors become

```text
src/main.ts:18
```

instead of

```text
generated/main.cpp:542
```

---

## @inojs/types

Contains

- .d.ts
- IntelliSense
- JSDoc

Used by VSCode.

---

## @inojs/runtime

Shared runtime utilities.

---

# CLI

Create project

```bash
ino new blink
```

---

Development

```bash
ino dev
```

Automatically

- watch
- transpile
- build
- upload
- monitor

---

Build

```bash
ino build
```

---

Upload

```bash
ino upload
```

---

Monitor

```bash
ino monitor
```

---

Clean

```bash
ino clean
```

---

Install module

```bash
ino add servo
```

---

Remove module

```bash
ino remove servo
```

---

Update

```bash
ino update
```

---

Doctor

```bash
ino doctor
```

Checks

- PlatformIO
- board
- compiler
- dependencies

---

# Project Structure

```text
my-project/

src/
    main.js

ino.config.ts

platformio.ini

package.json

node_modules/

.ino/
```

---

# Configuration

```ts
export default {
  board: "uno",

  framework: "arduino",

  monitor: true,

  serial: {
    baudRate: 115200,
  },

  optimize: true,
};
```

---

# API Design

```js
const core = init({
  serialMonitor: true,

  baudRate: 115200,
});
```

---

Setup

```js
core.setup(() => {});
```

---

Loop

```js
core.loop(() => {});
```

---

Pin

```js
const led = core.pin(13);

led.output();

led.high();

led.low();

led.toggle();

led.read();
```

---

Serial

```js
const serial = core.serial();

serial.println("Hello");
```

---

# IntelliSense

Works for both

```text
main.js
```

and

```text
main.ts
```

Using

```text
index.d.ts
```

Developer receives

- autocomplete
- hover
- documentation
- parameter hints
- quick fix

without requiring TypeScript.

---

# Module System

Install

```bash
ino add servo
```

Use

```js
import { Servo } from "@inojs/servo";

const servo = new Servo(9);
```

No manual Arduino library installation.

---

# Plugin Structure

```text
servo/

package.json

plugin.json

generator.ts

templates/

index.ts

index.d.ts

README.md
```

---

Each plugin may contribute

- include
- globals
- setup
- loop
- helper functions
- PlatformIO dependencies
- diagnostics
- snippets

---

# VSCode Extension

Features

- Syntax Highlight
- IntelliSense
- Diagnostics
- Hover
- Snippets
- Auto Import
- Error Mapping
- Build
- Upload
- Monitor
- Project Wizard

Future

- Live Pin Viewer
- Board Explorer
- Library Explorer
- Generated C++ Preview
- Performance Analyzer

---

# Compiler Pipeline

```text
Source

↓

Parser

↓

AST

↓

Semantic Analysis

↓

Plugin Analysis

↓

AST Transform

↓

Dependency Resolution

↓

C++ Generation

↓

Source Map

↓

PlatformIO Build
```

---

# Future Optimizations

- Constant Folding
- Dead Code Elimination
- Tree Shaking
- Include Optimization
- Function Inlining
- Build Cache
- Incremental Compilation

---

# Milestones

## Phase 1 — Foundation

- Monorepo
- CLI
- Parser
- AST
- Generator
- PlatformIO Adapter

---

## Phase 2 — Core

- setup()
- loop()
- pin()
- serial()
- delay()
- digital I/O
- analog I/O

---

## Phase 3 — Compiler

- diagnostics
- source map
- plugin system
- dependency resolver

---

## Phase 4 — Developer Experience

- VSCode Extension
- IntelliSense
- snippets
- hover
- quick fix

---

## Phase 5 — Official Modules

- Servo
- LCD
- OLED
- EEPROM
- SD
- DHT
- NeoPixel
- WiFi
- MQTT
- Bluetooth

---

## Phase 6 — Boards

- Arduino Uno
- Mega
- Nano
- ESP32
- RP2040
- STM32
- Teensy

---

## Phase 7 — Ecosystem

- Registry
- Documentation
- Examples
- Plugin Marketplace
- Community Modules

---

# Long-Term Goal

inoJS tidak bertujuan menggantikan Arduino.

inoJS bertujuan menjadi **lapisan modern di atas ekosistem Arduino dan PlatformIO**.

PlatformIO tetap menjadi build engine yang andal.

Arduino tetap menjadi framework firmware.

inoJS menghadirkan pengalaman pengembangan yang modern melalui JavaScript/TypeScript, transpiler yang cerdas, plugin yang konsisten, IntelliSense yang lengkap, dan CLI yang sederhana sehingga pengembangan embedded terasa senyaman membangun aplikasi web modern.
