import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { spawn } from "child_process";

const CODE_MAX_CHARS = 20000;
const EXEC_TIMEOUT_MS = 4000;
const MAX_OUTPUT_BYTES = 32 * 1024;

function trimToMaxBytes(value, maxBytes) {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  return Buffer.from(value, "utf8").subarray(0, maxBytes).toString("utf8");
}

function resolveJavaMainClass(code) {
  const publicMatch = code.match(/\bpublic\s+class\s+([A-Za-z_]\w*)\b/);
  if (publicMatch?.[1]) return publicMatch[1];

  const classMatch = code.match(/\bclass\s+([A-Za-z_]\w*)\b/);
  if (classMatch?.[1]) return classMatch[1];

  return "Main";
}

function runProcess(command, args, options = {}) {
  const { cwd, timeoutMs = EXEC_TIMEOUT_MS, maxOutputBytes = MAX_OUTPUT_BYTES } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let exceededOutput = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const appendChunk = (target, chunk) => {
      const next = target + chunk.toString("utf8");
      if (Buffer.byteLength(next, "utf8") > maxOutputBytes) {
        exceededOutput = true;
        child.kill("SIGKILL");
        return trimToMaxBytes(next, maxOutputBytes);
      }
      return next;
    };

    child.stdout.on("data", (chunk) => {
      stdout = appendChunk(stdout, chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr = appendChunk(stderr, chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode, stdout, stderr, timedOut, exceededOutput });
    });
  });
}

export async function executeCode(req, res) {
  let runDir = null;

  try {
    const { language, code } = req.body;

    if (!language || typeof language !== "string") {
      return res.status(400).json({ message: "Language is required" });
    }

    if (typeof code !== "string") {
      return res.status(400).json({ message: "Code must be a string" });
    }

    if (code.length > CODE_MAX_CHARS) {
      return res.status(400).json({ message: `Code is too large (max ${CODE_MAX_CHARS} chars)` });
    }

    if (!["javascript", "python", "java"].includes(language)) {
      return res.status(400).json({ message: `Unsupported language: ${language}` });
    }

    runDir = path.join(os.tmpdir(), `intbit-run-${randomUUID()}`);
    await fs.mkdir(runDir, { recursive: true });

    let result;
    if (language === "javascript") {
      const filePath = path.join(runDir, "main.js");
      await fs.writeFile(filePath, code, "utf8");
      result = await runProcess("node", [filePath], { cwd: runDir });
    } else if (language === "python") {
      const filePath = path.join(runDir, "main.py");
      await fs.writeFile(filePath, code, "utf8");
      result = await runProcess("python", [filePath], { cwd: runDir });
    } else {
      const mainClass = resolveJavaMainClass(code);
      const filePath = path.join(runDir, `${mainClass}.java`);
      await fs.writeFile(filePath, code, "utf8");

      const compileResult = await runProcess("javac", [filePath], { cwd: runDir });
      if (compileResult.timedOut) {
        return res.status(200).json({
          success: false,
          output: compileResult.stdout,
          error: "Compilation timed out",
        });
      }

      if (compileResult.exceededOutput) {
        return res.status(200).json({
          success: false,
          output: compileResult.stdout,
          error: "Compilation output exceeded size limit",
        });
      }

      if (compileResult.exitCode !== 0) {
        return res.status(200).json({
          success: false,
          output: compileResult.stdout,
          error: compileResult.stderr || "Compilation failed",
        });
      }

      result = await runProcess("java", ["-cp", runDir, mainClass], { cwd: runDir });
    }

    if (result.timedOut) {
      return res.status(200).json({
        success: false,
        output: result.stdout,
        error: "Execution timed out",
      });
    }

    if (result.exceededOutput) {
      return res.status(200).json({
        success: false,
        output: result.stdout,
        error: "Output exceeded size limit",
      });
    }

    if (result.exitCode !== 0) {
      return res.status(200).json({
        success: false,
        output: result.stdout,
        error: result.stderr || "Execution failed",
      });
    }

    return res.status(200).json({
      success: true,
      output: result.stdout || "No output",
    });
  } catch (error) {
    console.log("Error in executeCode controller:", error.message);
    const commandNotFound =
      error?.code === "ENOENT" ? "Required runtime not found on server" : "Internal Server Error";
    return res.status(500).json({ message: commandNotFound });
  } finally {
    if (runDir) {
      await fs.rm(runDir, { recursive: true, force: true }).catch(() => null);
    }
  }
}
