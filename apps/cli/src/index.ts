#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileProject } from "@inojs/compiler";

const [command = "help", ...args] = process.argv.slice(2);

try {
  if (command === "new") {
    await createProject(args[0] ?? "inojs-app");
  } else if (command === "build") {
    const result = await prepareFirmwareProject();
    console.log("Building firmware...");
    await runPlatformIO(["run"], resultDir(result.generatedCppPath));
  } else if (command === "upload") {
    const result = await prepareFirmwareProject();
    console.log("Uploading firmware...");
    await runPlatformIO(["run", "--target", "upload"], resultDir(result.generatedCppPath));
  } else if (command === "monitor") {
    await runPlatformIO(["device", "monitor"], join(process.cwd(), ".ino/generated"));
  } else if (command === "doctor") {
    await runPlatformIO(["--version"], process.cwd());
  } else {
    printHelp();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function createProject(name: string): Promise<void> {
  const root = join(process.cwd(), name);
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src/main.js"), [
    'import { Ino } from "@inojs/core";',
    "",
    "const core = new Ino();",
    "const led = core.pin(13);",
    "",
    "core.setup(() => {",
    "  led.output();",
    "});",
    "",
    "core.loop(() => {",
    "  led.toggle();",
    "  core.delay(1000);",
    "});",
    ""
  ].join("\n"), "utf8");
  await writeFile(join(root, "ino.config.json"), JSON.stringify({ board: "uno" }, null, 2), "utf8");
  await writeFile(join(root, "package.json"), JSON.stringify({
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    dependencies: {
      "@inojs/core": "workspace:*"
    }
  }, null, 2), "utf8");
  await writeFile(join(root, "jsconfig.json"), JSON.stringify({
    compilerOptions: {
      checkJs: true,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      target: "ES2022",
      skipLibCheck: true,
      maxNodeModuleJsDepth: 0,
      types: [],
      paths: {
        "@inojs/core": ["../packages/core/src/index.d.ts"]
      }
    },
    include: ["src/**/*.js"],
    exclude: ["node_modules", ".ino"]
  }, null, 2), "utf8");
  console.log(`Created ${name}`);
}

async function prepareFirmwareProject() {
  const result = await compileProject({
    cwd: process.cwd(),
    platformio: process.env.INO_BOARD ? { board: process.env.INO_BOARD } : undefined
  });
  for (const diagnostic of result.diagnostics) {
    console.warn(`${diagnostic.level}: ${diagnostic.message}`);
  }
  return result;
}

async function runPlatformIO(args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pio", args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`PlatformIO exited with code ${code}`)));
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error("PlatformIO is not installed or `pio` is not available in PATH. Install PlatformIO, then run `ino doctor`."));
        return;
      }
      reject(error);
    });
  });
}

function resultDir(generatedCppPath: string): string {
  return generatedCppPath.replace(/\/src\/main\.cpp$/, "");
}

function printHelp(): void {
  console.log([
    "ino <command>",
    "",
    "Commands:",
    "  new <name>     Create a new inoJS project",
    "  build          Build firmware",
    "  upload         Upload firmware",
    "  monitor        Open PlatformIO serial monitor",
    "  doctor         Check PlatformIO availability",
    ""
  ].join("\n"));
}
