import { execFile } from "node:child_process"
import process from "node:process"
import { promisify } from "node:util"

import { defineTool, z } from "openchatx-mcp/toolbox"

const execFileAsync = promisify(execFile)
const AGY_COMMAND = process.platform === "win32" ? "agy.exe" : "agy"

export default defineTool({
  name: "agy_ask",
  description:
    "Delegate a local task to the installed Antigravity/AGY CLI in non-interactive print mode. Use plan mode for read-only analysis and accept-edits when edits are intended.",
  inputSchema: z.object({
    prompt: z.string().min(1),
    cwd: z.string().min(1).optional(),
    mode: z.enum(["plan", "accept-edits"]).default("plan"),
    effort: z.enum(["low", "medium", "high", "max"]).default("medium"),
    skip_permissions: z.boolean().default(false),
    timeout_ms: z.number().int().min(1000).max(3600000).default(900000),
  }),
  async execute({ prompt, cwd, mode, effort, skip_permissions, timeout_ms }) {
    const args = [
      "--print",
      prompt,
      "--output-format",
      "text",
      "--mode",
      mode,
      "--effort",
      effort,
    ]
    if (skip_permissions) args.push("--dangerously-skip-permissions")

    try {
      const { stdout, stderr } = await execFileAsync(AGY_COMMAND, args, {
        cwd,
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
            text: output || errorOutput || "AGY completed with no output.",
          },
        ],
        structuredContent: {
          agent: "agy",
          ok: true,
          cwd: cwd ?? null,
          mode,
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
        `AGY failed${failure.code ? ` (code ${failure.code})` : ""}: ${details}`,
      )
    }
  },
})
