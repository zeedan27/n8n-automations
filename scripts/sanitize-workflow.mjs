import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const workflowsRoot = path.join(repoRoot, "workflows");

const CREDENTIAL_PLACEHOLDER = {
  id: "<YOUR_CREDENTIAL_ID>",
  name: "<CONFIGURE_IN_N8N>"
};

const SECRET_PATTERNS = [
  /sk-(?:proj-|ant-)?[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /Bearer [A-Za-z0-9._-]{20,}/g,
  /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/g
];

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SAFE_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "placeholder.com",
  "yourdomain.com",
  "domain.com",
  "test.com"
]);

function scrubString(value) {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "<REDACTED_SECRET>");
  }
  out = out.replace(EMAIL_PATTERN, (match) => {
    const domain = match.split("@")[1]?.toLowerCase() || "";
    if (SAFE_EMAIL_DOMAINS.has(domain)) return match;
    return "user@example.com";
  });
  return out;
}

function scrubValue(node) {
  if (typeof node === "string") return scrubString(node);
  if (Array.isArray(node)) return node.map(scrubValue);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = scrubValue(v);
    }
    return out;
  }
  return node;
}

function sanitizeWorkflow(rawObj, overrideName = "") {
  const wf = structuredClone(rawObj);

  delete wf.id;
  delete wf.pinData;
  delete wf.staticData;
  delete wf.versionId;

  if (wf.meta && typeof wf.meta === "object") {
    delete wf.meta.instanceId;
    if (Object.keys(wf.meta).length === 0) {
      delete wf.meta;
    }
  }

  if ((!wf.name || !String(wf.name).trim()) && overrideName) {
    wf.name = overrideName;
  }

  if (Array.isArray(wf.nodes)) {
    wf.nodes = wf.nodes.map((node) => {
      const cleanNode = { ...node };
      delete cleanNode.webhookId;

      if (cleanNode.credentials && typeof cleanNode.credentials === "object") {
        const cleanCreds = {};
        for (const credKey of Object.keys(cleanNode.credentials)) {
          cleanCreds[credKey] = { ...CREDENTIAL_PLACEHOLDER };
        }
        cleanNode.credentials = cleanCreds;
      }

      return scrubValue(cleanNode);
    });
  }

  return scrubValue(wf);
}

function collectJsonFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      results.push(full);
    }
  }
  return results.sort();
}

function findStringSecrets(value, loc = "$", findings = []) {
  if (typeof value === "string") {
    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(value)) {
        findings.push(`${loc}: matched secret pattern ${pattern}`);
      }
    }
    EMAIL_PATTERN.lastIndex = 0;
    const emails = value.match(EMAIL_PATTERN) || [];
    for (const email of emails) {
      const domain = email.split("@")[1]?.toLowerCase() || "";
      if (!SAFE_EMAIL_DOMAINS.has(domain)) {
        findings.push(`${loc}: non-placeholder email domain (${domain})`);
      }
    }
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => findStringSecrets(item, `${loc}[${idx}]`, findings));
    return findings;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      findStringSecrets(v, `${loc}.${k}`, findings);
    }
  }
  return findings;
}

function checkWorkflowFile(filePath) {
  const rel = path.relative(repoRoot, filePath);
  const raw = fs.readFileSync(filePath, "utf8");
  const wf = JSON.parse(raw);
  const errors = [];

  if (!wf.name || !String(wf.name).trim()) {
    errors.push("missing non-empty workflow name");
  }
  if (!Array.isArray(wf.nodes) || wf.nodes.length === 0) {
    errors.push("missing non-empty nodes[] array");
  }
  if (wf.id !== undefined) errors.push("top-level id must be removed");
  if (wf.versionId !== undefined) errors.push("versionId must be removed");
  if (wf.pinData !== undefined) errors.push("pinData must be removed");
  if (wf.staticData !== undefined) errors.push("staticData must be removed");
  if (wf.meta?.instanceId !== undefined) errors.push("meta.instanceId must be removed");

  if (Array.isArray(wf.nodes)) {
    wf.nodes.forEach((node, idx) => {
      if (node.webhookId !== undefined) {
        errors.push(`nodes[${idx}].webhookId must be removed`);
      }
      if (node.credentials && typeof node.credentials === "object") {
        for (const [credKey, credVal] of Object.entries(node.credentials)) {
          if (
            !credVal ||
            credVal.id !== CREDENTIAL_PLACEHOLDER.id ||
            credVal.name !== CREDENTIAL_PLACEHOLDER.name
          ) {
            errors.push(`nodes[${idx}].credentials.${credKey} is not sanitized to placeholder`);
          }
        }
      }
    });
  }

  errors.push(...findStringSecrets(wf));

  return { rel, name: wf.name, nodeCount: wf.nodes?.length || 0, errors };
}

function run() {
  const args = process.argv.slice(2);

  if (args[0] === "--import") {
    const srcPath = args[1];
    const destPath = args[2];
    if (!srcPath || !destPath) {
      console.error("Usage: node scripts/sanitize-workflow.mjs --import <src> <dest> [--name \"Title\"]");
      process.exit(1);
    }
    const nameIdx = args.indexOf("--name");
    const overrideName = nameIdx !== -1 ? args[nameIdx + 1] || "" : "";

    const raw = fs.readFileSync(path.resolve(srcPath), "utf8");
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeWorkflow(parsed, overrideName);
    const outAbs = path.resolve(repoRoot, destPath);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify(sanitized, null, 2) + "\n", "utf8");
    console.log(`Sanitized -> ${path.relative(repoRoot, outAbs)} (${sanitized.name}, ${sanitized.nodes?.length || 0} nodes)`);
    return;
  }

  const checkMode = args.includes("--check");
  const files = collectJsonFiles(workflowsRoot);
  if (files.length === 0) {
    console.error("No workflow JSON files found under workflows/");
    process.exit(1);
  }

  if (!checkMode) {
    for (const filePath of files) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const sanitized = sanitizeWorkflow(parsed);
      fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2) + "\n", "utf8");
    }
  }

  let hasErrors = false;
  for (const filePath of files) {
    const res = checkWorkflowFile(filePath);
    if (res.errors.length > 0) {
      hasErrors = true;
      console.error(`FAIL ${res.rel}:`);
      for (const err of res.errors) console.error(`  - ${err}`);
    } else {
      console.log(`PASS ${res.rel} (${res.name}, ${res.nodeCount} nodes)`);
    }
  }

  if (hasErrors) process.exit(1);
  console.log(`\nVerified ${files.length} sanitized n8n workflow(s).`);
}

run();
