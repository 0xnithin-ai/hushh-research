/* eslint-disable no-console */
/**
 * verify-shadcn-parity.cjs
 *
 * Hard parity gate for registry-backed components under components/ui.
 * Compares local files against shadcn registry view output.
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const webappRoot = path.resolve(__dirname, "..");

const REGISTRY_COMPONENTS = [
  "accordion",
  "alert",
  "alert-dialog",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "card",
  "carousel",
  "chart",
  "checkbox",
  "collapsible",
  "combobox",
  "command",
  "dialog",
  "drawer",
  "dropdown-menu",
  "input",
  "input-group",
  "kbd",
  "label",
  "pagination",
  "popover",
  "progress",
  "radio-group",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "sonner",
  "spinner",
  "table",
  "tabs",
  "textarea",
  "tooltip",
];

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, "\n").trimEnd() + "\n";
}

function normalizeRegistryContent(content) {
  let out = content;
  out = out.replace(/@\/registry\/new-york-v4\/ui\//g, "@/components/ui/");
  out = out.replace(
    /@\/registry\/new-york-v4\/lib\/utils/g,
    "@/lib/utils"
  );
  out = out.replace(
    /@\/registry\/new-york-v4\/hooks\/use-mobile/g,
    "@/hooks/use-mobile"
  );
  out = out.replace(/@\/registry\/new-york-v4\/hooks\//g, "@/hooks/");
  out = out.replace(/from \"radix-ui\"/g, 'from "radix-ui"');
  return normalizeNewlines(out);
}

function readFile(relPath) {
  return normalizeNewlines(fs.readFileSync(path.join(webappRoot, relPath), "utf8"));
}

function getRegistryItem(component) {
  const cmd = `npx shadcn@latest view @shadcn/${component}`;
  const raw = execSync(cmd, {
    cwd: webappRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
  });
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error(`empty snapshot for @shadcn/${component}`);
  }
  return parsed[0];
}

function findRegistryFile(item) {
  if (!item || !Array.isArray(item.files)) return null;
  return (
    item.files.find((f) => f.path && f.path.endsWith(`/ui/${item.name}.tsx`)) ||
    item.files[0] ||
    null
  );
}

function main() {
  const failures = [];

  for (const component of REGISTRY_COMPONENTS) {
    let item;
    try {
      item = getRegistryItem(component);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(`@shadcn/${component}: failed to fetch snapshot (${detail})`);
      continue;
    }

    const registryFile = findRegistryFile(item);
    if (!registryFile || typeof registryFile.content !== "string") {
      failures.push(`@shadcn/${component}: registry file content missing`);
      continue;
    }

    const relPath = `components/ui/${component}.tsx`;
    const absPath = path.join(webappRoot, relPath);
    if (!fs.existsSync(absPath)) {
      failures.push(`${relPath}: missing local file`);
      continue;
    }

    const expected = normalizeRegistryContent(registryFile.content);
    const actual = readFile(relPath);

    if (expected !== actual) {
      failures.push(
        `${relPath}: drifted from registry (refresh with: npx shadcn@latest add ${component} --overwrite)`
      );
    }
  }

  if (failures.length) {
    console.error("\n[verify:shadcn-parity] FAILURES");
    for (const finding of failures) {
      console.error(`- ${finding}`);
    }
    process.exit(1);
  }

  console.log("OK: shadcn registry parity verified");
}

main();
