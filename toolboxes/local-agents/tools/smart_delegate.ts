import { execFile } from "node:child_process"
import process from "node:process"
import { promisify } from "node:util"

import { defineTool, z } from "openchatx-mcp/toolbox"

const execFileAsync = promisify(execFile)
const HERMES_COMMAND = process.platform === "win32" ? "hermes.exe" : "hermes"
const AGY_COMMAND = process.platform === "win32" ? "agy.exe" : "agy"

async function run(
  command: string,
  args: string[],
  cwd: string | undefined,
  timeout: number,
) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd,
    env: cwd ? { ...process.env, TERMINAL_CWD: cwd } : process.env,
    encoding: "utf8",
    windowsHide: true,
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  })
  return {
    stdout: String(stdout ?? "").trim(),
    stderr: String(stderr ?? "").trim(),
  }
}

function failureText(error: unknown) {
  const failure = error as Error & {
    code?: string | number
    stdout?: string | Buffer
    stderr?: string | Buffer
  }
  return [
    failure.code ? `code ${failure.code}` : "",
    String(failure.stdout ?? "").trim(),
    String(failure.stderr ?? "").trim(),
    failure.message,
  ]
    .filter(Boolean)
    .join("\n")
}

export default defineTool({
  name: "smart_delegate",
  description:
    "Delegate a complex local task to Hermes first and automatically fall back to AGY only when the Hermes process fails. Prefer direct OpenChatX tools for simple file edits, Git inspection, and test commands.",
  inputSchema: z.object({
    prompt: z.string().min(1),
    cwd: z.string().min(1).optional(),
    hermes_reasoning: z
      .enum(["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"])
      .default("medium"),
    agy_mode: z.enum(["plan", "accept-edits"]).default("plan"),
    agy_effort: z.enum(["low", "medium", "high", "max"]).default("medium"),
    timeout_ms: z.number().int().min(1000).max(3600000).default(900000),
  }),
  async execute({
    prompt,
    cwd,
    hermes_reasoning,
    agy_mode,
    agy_effort,
    timeout_ms,
  }) {
    const hermesArgs = ["--reasoning", hermes_reasoning]
    if (cwd) hermesArgs.push("--in", cwd)
    hermesArgs.push("-z", prompt)

    try {
      const result = await run(HERMES_COMMAND, hermesArgs, cwd, timeout_ms)
      return {
        content: [
          {
            type: "text",
            text:
              result.stdout ||
              result.stderr ||
              "Hermes completed with no output.",
          },
        ],
        structuredContent: {
          selected_agent: "hermes",
          fallback_used: false,
          cwd: cwd ?? null,
        },
      }
    } catch (hermesError) {
      const hermesFailure = failureText(hermesError)
      const agyArgs = [
        "--print",
        prompt,
        "--output-format",
        "text",
        "--mode",
        agy_mode,
        "--effort",
        agy_effort,
      ]

      try {
        const result = await run(AGY_COMMAND, agyArgs, cwd, timeout_ms)
        return {
          content: [
            {
              type: "text",
              text:
                result.stdout ||
                result.stderr ||
                "AGY completed with no output.",
            },
          ],
          structuredContent: {
            selected_agent: "agy",
            fallback_used: true,
            cwd: cwd ?? null,
            hermes_failure: hermesFailure,
          },
        }
      } catch (agyError) {
        throw new Error(
          `Both local agents failed. Hermes:\n${hermesFailure}\n\nAGY:\n${failureText(agyError)}`,
        )
      }
    }
  },
})
