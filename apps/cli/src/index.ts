#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { compileProject, type Diagnostic } from "@inojs/compiler";

const [command = "help", ...args] = process.argv.slice(2);

try {
  if (command === "new") {
    await createProject(args[0] ?? "inojs-app");
  } else if (command === "build") {
    const result = await prepareFirmwareProject();
    console.log("Building firmware...");
    await runPlatformIO(["run"], resultDir(result.generatedCppPath));
  } else if (command === "dev") {
    const result = await prepareFirmwareProject();
    console.log("Building and uploading firmware...");
    await runPlatformIO(["run", "--target", "upload"], resultDir(result.generatedCppPath));
    console.log("Opening serial monitor...");
    await runPlatformIO(["device", "monitor"], resultDir(result.generatedCppPath));
  } else if (command === "upload") {
    const result = await prepareFirmwareProject();
    console.log("Uploading firmware...");
    await runPlatformIO(["run", "--target", "upload"], resultDir(result.generatedCppPath));
  } else if (command === "monitor") {
    await runPlatformIO(["device", "monitor"], join(process.cwd(), ".ino/generated"));
  } else if (command === "clean") {
    await rm(join(process.cwd(), ".ino"), { recursive: true, force: true });
    console.log("Cleaned .ino");
  } else if (command === "add") {
    await updateDependency(args[0], "add");
  } else if (command === "remove") {
    await updateDependency(args[0], "remove");
  } else if (command === "update") {
    await runInteractive("pnpm", ["update"], process.cwd());
  } else if (command === "doctor") {
    await runDoctor(args);
  } else {
    printHelp();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

const modulePackages: Record<string, string> = {
  bluetooth: "@inojs/bluetooth",
  dht: "@inojs/dht",
  eeprom: "@inojs/eeprom",
  lcd: "@inojs/lcd",
  mqtt: "@inojs/mqtt",
  neopixel: "@inojs/neopixel",
  oled: "@inojs/oled",
  sd: "@inojs/sd",
  servo: "@inojs/servo",
  wifi: "@inojs/wifi"
};

async function updateDependency(name: string | undefined, action: "add" | "remove"): Promise<void> {
  if (!name) throw new Error(`Usage: ino ${action} <module>`);
  const packageName = modulePackages[name] ?? name;
  const packageJsonPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(await readFile(packageJsonPath, "utf8")) as { dependencies?: Record<string, string> };
  pkg.dependencies ??= {};
  if (action === "add") {
    pkg.dependencies[packageName] = "workspace:*";
  } else {
    delete pkg.dependencies[packageName];
  }
  await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  await runInteractive("pnpm", ["install"], process.cwd());
  console.log(`${action === "add" ? "Added" : "Removed"} ${packageName}`);
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
    console.warn(formatDiagnostic(diagnostic));
  }
  return result;
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const prefix = diagnostic.location
    ? `${diagnostic.location.filename ?? "source"}:${diagnostic.location.line}:${diagnostic.location.column}`
    : "source";
  return `${prefix} ${diagnostic.level}: ${diagnostic.message}`;
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

interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

async function runDoctor(args: string[]): Promise<void> {
  const fix = args.includes("--fix") || args.includes("-f");
  console.log("ino doctor");
  console.log("");

  const pio = await checkCommand("pio", ["--version"]);
  printCheck("PlatformIO CLI", pio);
  if (pio.ok) {
    console.log(`  ${firstLine(pio.stdout)}`);
  }

  const python = await findPython();
  printCheck("Python", python.result);
  if (python.result.ok) {
    console.log(`  ${firstLine(python.result.stdout)}`);
  }

  const code = await checkCommand("code", ["--version"]);
  printCheck("VSCode CLI", code);
  if (code.ok) {
    console.log(`  ${firstLine(code.stdout)}`);
  }

  if (pio.ok) {
    console.log("");
    console.log("All required dependencies are available.");
    return;
  }

  console.log("");
  console.log("PlatformIO is required for build, upload, and monitor.");

  if (!fix) {
    const shouldInstall = await confirm("Install missing PlatformIO dependency now? [y/N] ");
    if (!shouldInstall) {
      console.log("Skipped install. Run `ino doctor --fix` when you are ready.");
      return;
    }
  }

  await installPlatformIO({ python, code });
}

async function installPlatformIO(options: {
  python: { command: string | undefined; result: CommandResult };
  code: CommandResult;
}): Promise<void> {
  const choices = [
    options.python.command ? "1) Python/pip - installs the `pio` command" : undefined,
    options.code.ok ? "2) VSCode extension - installs PlatformIO IDE in VSCode" : undefined,
    "3) Cancel"
  ].filter(Boolean);

  console.log("");
  console.log("Choose install method:");
  for (const choice of choices) console.log(`  ${choice}`);

  const answer = await ask("Select [1/2/3]: ");
  if (answer === "1" && options.python.command) {
    console.log("Installing PlatformIO with Python/pip...");
    await runInteractive(options.python.command, ["-m", "pip", "install", "--upgrade", "platformio"], process.cwd());
    console.log("PlatformIO install finished. Run `ino doctor` to verify.");
    return;
  }

  if (answer === "2" && options.code.ok) {
    console.log("Installing PlatformIO IDE VSCode extension...");
    await runInteractive("code", ["--install-extension", "platformio.platformio-ide"], process.cwd());
    console.log("VSCode extension install finished. Restart VSCode if needed, then run `ino doctor`.");
    return;
  }

  console.log("Cancelled.");
}

async function findPython(): Promise<{ command: string | undefined; result: CommandResult }> {
  for (const command of ["python3", "python"]) {
    const result = await checkCommand(command, ["--version"]);
    if (result.ok) return { command, result };
  }

  return {
    command: undefined,
    result: {
      ok: false,
      stdout: "",
      stderr: "python3/python not found",
      code: null
    }
  };
}

async function checkCommand(command: string, args: string[]): Promise<CommandResult> {
  return await new Promise<CommandResult>((resolve) => {
    let settled = false;
    const child = spawn(command, args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ ok: false, stdout, stderr: `${command} check timed out`, code: null });
    }, 5000);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ok: code === 0, stdout, stderr, code });
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ok: false, stdout, stderr: error.message, code: null });
    });
  });
}

async function runInteractive(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
    child.on("error", reject);
  });
}

async function confirm(question: string): Promise<boolean> {
  const answer = await ask(question);
  return ["y", "yes"].includes(answer.toLowerCase());
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function printCheck(label: string, result: CommandResult): void {
  console.log(`${result.ok ? "OK" : "MISSING"} ${label}`);
}

function firstLine(value: string): string {
  return value.trim().split(/\r?\n/)[0] ?? "";
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
    "  dev            Build, upload, and monitor",
    "  build          Build firmware",
    "  upload         Upload firmware",
    "  monitor        Open PlatformIO serial monitor",
    "  clean          Remove generated files",
    "  add <module>   Add an inoJS module",
    "  remove <module> Remove an inoJS module",
    "  update         Update project dependencies",
    "  doctor         Check and install missing dependencies",
    ""
  ].join("\n"));
}
