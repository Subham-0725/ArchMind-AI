// server/test-secret-scanner.js
import assert from "assert";
import { scanFileContent } from "./src/rie/security/secretScanner.js";
import { redactSecrets } from "./src/rie/security/secretRedactor.js";

console.log("==================================================");
console.log("Running RIE Secret Scanner & Redactor Test Suite");
console.log("==================================================");

let passed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. AWS Access Key Detection
it("Detects AWS Access Key ID with high confidence and masks it", () => {
  const code = `
    const AWS = require('aws-sdk');
    const key = "AKIAIOSFODNN7EXAMPLE";
  `;
  const findings = scanFileContent(code, "src/awsConfig.js");
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].category, "AWS Access Key ID");
  assert.strictEqual(findings[0].lineNumber, 3);
  assert.strictEqual(findings[0].severity, "Critical");
  assert.strictEqual(findings[0].maskedValue, "AKIA********MPLE");
  assert.ok(!findings[0].maskedValue.includes("IOSFODNN7"));
});

// 2. GitHub Personal Access Token Detection
it("Detects GitHub PAT and masks sensitive characters", () => {
  const code = `
    // Configuration file
    const token = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  `;
  const findings = scanFileContent(code, "config.js");
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].category, "GitHub Personal Access Token");
  assert.strictEqual(findings[0].lineNumber, 3);
  assert.strictEqual(findings[0].severity, "Critical");
  assert.strictEqual(findings[0].maskedValue, "ghp_********6789");
});

// 3. Private SSH / RSA Key Detection
it("Detects Private Key blocks", () => {
  const keyContent = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Yq3...
-----END RSA PRIVATE KEY-----
  `;
  const findings = scanFileContent(keyContent, "id_rsa");
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].category, "Private Key");
  assert.strictEqual(findings[0].severity, "Critical");
});

// 4. Database Connection String with Credentials
it("Detects MongoDB connection string with embedded password", () => {
  const code = `
    const MONGO_URI = "mongodb+srv://admin:SuperSecretPass123@cluster0.abc.mongodb.net/prod";
  `;
  const findings = scanFileContent(code, ".env");
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].category, "Database Connection String (MongoDB)");
  assert.strictEqual(findings[0].lineNumber, 2);
  assert.ok(findings[0].maskedValue.includes("mongodb+srv://admin:****@"));
  assert.ok(!findings[0].maskedValue.includes("SuperSecretPass123"));
});

// 5. Secret Redaction before LLM Context
it("Redacts secrets from code text before sending to LLMs", () => {
  const rawCode = `
    const apiKey = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const awsKey = "AKIAIOSFODNN7EXAMPLE";
    const dbUrl = "mongodb://user:myPassWord99@localhost:27017/db";
  `;
  const redacted = redactSecrets(rawCode);

  assert.ok(!redacted.includes("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"));
  assert.ok(!redacted.includes("AKIAIOSFODNN7EXAMPLE"));
  assert.ok(!redacted.includes("myPassWord99"));
  assert.ok(redacted.includes("[REDACTED_SECRET:GITHUB_PERSONAL_ACCESS_TOKEN]"));
  assert.ok(redacted.includes("[REDACTED_SECRET:AWS_ACCESS_KEY_ID]"));
  assert.ok(redacted.includes("[REDACTED_SECRET:DATABASE_CONNECTION_STRING__MONGODB_]"));
});

// 6. Safe from False Positives
it("Ignores common non-secret placeholders and sample strings", () => {
  const code = `
    const pass = "your-password-here";
    const dummy = "placeholder_key";
  `;
  const findings = scanFileContent(code, "test.js");
  assert.strictEqual(findings.length, 0);
});

console.log("==================================================");
console.log(`Test Results: ${passed} PASSED, 0 FAILED`);
console.log("==================================================");

