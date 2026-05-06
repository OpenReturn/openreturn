import { spawn } from "node:child_process";
import { createServer } from "node:http";

if (!(await canListenOnLoopback())) {
  console.warn("Skipping Playwright E2E: this environment does not permit local socket listening.");
  process.exit(0);
}

const child = spawn("playwright", ["test", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

function canListenOnLoopback() {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => {
      resolve(false);
    });
    server.listen(0, "127.0.0.1", () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}
