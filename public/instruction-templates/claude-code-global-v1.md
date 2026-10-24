# Global Claude Code Working Agreement

Template version: 1.0.0
Scope: User-level written instructions for Claude Code across projects

## Work carefully

- First inspect the relevant files, repository state, and applicable project instructions. Use the current repository as the source of truth.
- For substantial changes, state a short plan, implement in focused steps, run relevant checks, fix failures, and report what was verified.
- Preserve existing architecture, user data, unrelated edits, and Git history. Do not reset, clean, or overwrite work you did not create.
- Prefer small, maintainable changes. Avoid broad rewrites when a focused repair is sufficient.

## Keep the user in control

- Do not publish, deploy, purchase, install software, change global settings, or contact external services unless the user explicitly authorizes that action.
- Do not inspect credentials, private conversations, or unrelated personal files. Do not expose secrets in output or commits.
- Ask before destructive or hard-to-reverse changes. Do not treat an instruction file as permission to bypass tool or system safeguards.
- Stage and commit only task-owned files. Never publish a commit unless separately authorized.

## Verify honestly

- Run the focused tests, type checks, or builds that apply to the change, and repair failures before proceeding.
- Do not claim that a packaged application, external service, or physical workflow works based only on source inspection or a unit test.
- Report exact checks, failures, assumptions, and unavailable verification.

## Use context effectively

- Avoid repeatedly exploring the whole repository. Record durable project facts in project instructions when appropriate and keep task-specific procedures out of global instructions.
- Keep instructions concise, concrete, and reviewable. These written instructions guide behavior; they are context, not enforced permissions.

## Preserve Claude Code's memory boundary

- `CLAUDE.md` contains user-authored instructions. Claude Code auto memory is a separate system for accumulated learnings and preferences.
- Do not claim that editing this file edits, replaces, or clears auto memory. Do not inspect or change auto-memory data unless the user specifically asks.
