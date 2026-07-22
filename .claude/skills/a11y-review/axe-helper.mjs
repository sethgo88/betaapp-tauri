// Shared helper for the /a11y-review skill: injects axe-core into an already-navigated
// Playwright page and returns violations summarized with WCAG SC numbers + levels.
//
// Usage from a one-off Node script (see SKILL.md):
//   import { chromium } from "@playwright/test";
//   import { runAxe, launchChromium } from "./.claude/skills/a11y-review/axe-helper.mjs";
//   const browser = await launchChromium();
//   const page = await browser.newPage();
//   await page.goto("http://localhost:1420/climbs/some-id");
//   // ... interact with the page (open a modal, focus a field, etc.) ...
//   const report = await runAxe(page);
//   console.log(JSON.stringify(report, null, 2));
//   await browser.close();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROMIUM_CANDIDATES = [
	"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
	"/opt/pw-browsers/chromium/chrome-linux/chrome",
];

function resolveChromiumExecutable() {
	for (const candidate of CHROMIUM_CANDIDATES) {
		if (fs.existsSync(candidate)) return candidate;
	}
	// Fall back to globbing PLAYWRIGHT_BROWSERS_PATH in case the pinned version changes.
	const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
	if (fs.existsSync(base)) {
		const dir = fs
			.readdirSync(base)
			.find((d) => d.startsWith("chromium-") || d === "chromium");
		if (dir) {
			const candidate = path.join(base, dir, "chrome-linux", "chrome");
			if (fs.existsSync(candidate)) return candidate;
		}
	}
	throw new Error(
		"Could not locate the pre-installed Chromium binary under PLAYWRIGHT_BROWSERS_PATH. " +
			"Do not run `playwright install` — check /opt/pw-browsers manually.",
	);
}

export async function launchChromium(launchOptions = {}) {
	const { chromium } = require("@playwright/test");
	return chromium.launch({
		executablePath: resolveChromiumExecutable(),
		args: ["--no-sandbox"],
		...launchOptions,
	});
}

const axeSource = fs.readFileSync(
	require.resolve("axe-core/axe.min.js"),
	"utf8",
);

// axe-core tags rules with e.g. "wcag111", "wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice".
// Turn those into a human SC number + level for the report.
function levelFromTags(tags) {
	if (tags.some((t) => /^wcag\d+aaa$/.test(t))) return "AAA";
	if (tags.some((t) => /^wcag(2|21|22)aa$/.test(t))) return "AA";
	if (tags.some((t) => /^wcag(2|21|22)a$/.test(t))) return "A";
	return "best-practice";
}

function scNumbersFromTags(tags) {
	return tags
		.filter((t) => /^wcag\d{3,4}$/.test(t))
		.map((t) => {
			const digits = t.replace("wcag", "");
			// wcag111 -> 1.1.1, wcag1411 -> 1.4.11
			if (digits.length === 3) return `${digits[0]}.${digits[1]}.${digits[2]}`;
			return `${digits[0]}.${digits[1]}.${digits.slice(2)}`;
		});
}

export async function runAxe(page, axeOptions = {}) {
	await page.addScriptTag({ content: axeSource });
	const raw = await page.evaluate(async (opts) => {
		// biome-ignore lint/suspicious/noExplicitAny: axe is injected globally, not typed here
		return await window.axe.run(opts.context ?? document, opts.runOptions ?? {});
	}, { context: axeOptions.context, runOptions: axeOptions.runOptions });

	const violations = raw.violations.map((v) => ({
		id: v.id,
		impact: v.impact,
		help: v.help,
		helpUrl: v.helpUrl,
		level: levelFromTags(v.tags),
		wcagSc: scNumbersFromTags(v.tags),
		nodeCount: v.nodes.length,
		targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
	}));

	return {
		url: page.url(),
		violationCount: violations.length,
		violations,
		passCount: raw.passes.length,
		incompleteCount: raw.incomplete.length,
	};
}
