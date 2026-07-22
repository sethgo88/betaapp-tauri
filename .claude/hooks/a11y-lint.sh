#!/usr/bin/env bash
# PostToolUse hook: surfaces Biome a11y lint violations for .tsx files right after
# an Edit/Write, without blocking (the edit already happened by the time this runs).
# Non-blocking by design — see docs/accessibility.md for the full three-layer workflow.
set -euo pipefail

input="$(cat)"
file_path="$(echo "$input" | jq -r '.tool_input.file_path // empty')"

[[ "$file_path" == *.tsx || "$file_path" == *.jsx ]] || exit 0
[[ -f "$file_path" ]] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}"

output="$(pnpm exec biome lint --only=a11y "$file_path" 2>&1)" || {
	echo "$output" >&2
	exit 2
}

exit 0
