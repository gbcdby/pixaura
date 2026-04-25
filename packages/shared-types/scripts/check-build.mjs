import { readdirSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL("..", import.meta.url));
const distFile = join(root, "dist", "index.d.ts");
const srcDir = join(root, "src");

function getLatestMtime(dir) {
	let latest = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			latest = Math.max(latest, getLatestMtime(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".ts")) {
			latest = Math.max(latest, statSync(fullPath).mtimeMs);
		}
	}
	return latest;
}

let distMtime = 0;
try {
	distMtime = statSync(distFile).mtimeMs;
} catch {
	// dist 不存在
}

if (distMtime >= getLatestMtime(srcDir)) {
	console.log("[shared-types] dist 已是最新，跳过构建");
	process.exit(0);
}
process.exit(1);
