const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;
  content = content.replace(/from\s+(['"])\.\/(.+?)\.js\1/g, "from $1./$2$1");
  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log("Fixed:", path.relative(distDir, filePath));
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (entry.endsWith(".d.ts") || entry.endsWith(".d.cts")) {
      fixFile(fullPath);
    }
  }
}

walk(distDir);
console.log("Done fixing .d.ts imports.");
