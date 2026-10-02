import { execFile } from "node:child_process"
import process from "node:process"
import { promisify } from "node:util"

import { defineTool, z } from "openchatx-mcp/toolbox"

const execFileAsync = promisify(execFile)
const HERMES_COMMAND = process.platform === "win32" ? "hermes.exe" : "hermes"

export default defineTool({
  name: "hermes_ask",
  description:
    "Delegate a complex local coding, review, or analysis task to the installed Hermes Agent in one-shot mode. Prefer direct OpenChatX tools for simple mechanical work.",
  inputSchema: z.object({
    prompt: z.string().min(1),
    cwd: z.string().min(1).optional(),
    reasoning: z
      .enum(["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"])
      .default("medium"),
    timeout_ms: z.number().int().min(1000).max(3600000).default(900000),
  }),
  async execute({ prompt, cwd, reasoning, timeout_ms }) {
    const args = ["--reasoning", reasoning]
    if (cwd) args.push("--in", cwd)
    args.push("-z", prompt)

    try {
      const { stdout, stderr } = await execFileAsync(HERMES_COMMAND, args, {
        cwd,
        env: cwd ? { ...process.env, TERMINAL_CWD: cwd } : process.env,
        encoding: "utf8",
        windowsHide: true,
        timeout: timeout_ms,
        maxBuffer: 16 * 1024 * 1024,
      })
      const output = String(stdout ?? "").trim()
      const errorOutput = String(stderr ?? "").trim()
      return {
        content: [
          {
            type: "text",
            text: output || errorOutput || "Hermes completed with no output.",
          },
        ],
        structuredContent: {
          agent: "hermes",
          ok: true,
          cwd: cwd ?? null,
          stderr: errorOutput || null,
        },
      }
    } catch (error) {
      const failure = error as Error & {
        code?: string | number
        stdout?: string | Buffer
        stderr?: string | Buffer
      }
      const details = [
        String(failure.stdout ?? "").trim(),
        String(failure.stderr ?? "").trim(),
        failure.message,
      ]
        .filter(Boolean)
        .join("\n")
      throw new Error(
        `Hermes failed${failure.code ? ` (code ${failure.code})` : ""}: ${details}`,
      )
    }
  },
})
