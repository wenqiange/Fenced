import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export interface HfParseInput {
  rawText: string;
  referenceDate?: string;
  ambiguities?: Array<{ kind: string; text: string }>;
}

export function findHfScriptPath(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), "scripts/use_model.py"),
    path.resolve(process.cwd(), "../../scripts/use_model.py"),
    path.resolve(currentDir, "../../../scripts/use_model.py"),
    path.resolve(currentDir, "../../scripts/use_model.py"),
  ];
  const found = possiblePaths.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`Hugging Face script 'use_model.py' not found in: ${possiblePaths.join(", ")}`);
  }
  return found;
}

/**
 * Executes the local Hugging Face task parsing model via scripts/use_model.py.
 */
export async function parseTaskWithHuggingFace(input: HfParseInput): Promise<any> {
  const scriptPath = findHfScriptPath();
  const pythonCmd = process.env.PYTHON_PATH || "python3";

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, [
      scriptPath,
      "--json",
      JSON.stringify({
        rawText: input.rawText,
        referenceDate: input.referenceDate || new Date().toISOString(),
      }),
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`Hugging Face parsing script exited with code ${code}: ${stderr}`),
        );
      }
      try {
        const trimmed = stdout.trim();
        // Extract the JSON object from stdout (in case of any stray print lines)
        const jsonStart = trimmed.indexOf("{");
        const jsonEnd = trimmed.lastIndexOf("}");
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error(`No JSON found in script output: ${trimmed}`);
        }
        const jsonStr = trimmed.slice(jsonStart, jsonEnd + 1);
        const data = JSON.parse(jsonStr);
        resolve(data);
      } catch (err: any) {
        reject(
          new Error(`Failed to decode Hugging Face output: ${stdout} (${err.message})`),
        );
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Python process (${pythonCmd}): ${err.message}`));
    });
  });
}
