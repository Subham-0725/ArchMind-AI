// server/src/devops/generators/kubernetes.generator.js
//
// Grounded Kubernetes Manifest Generator for ArchMind AI (Phase 5).
// Generates production-grade Kubernetes Deployments, Services, ConfigMaps,
// and Secret references with selector alignment, resource limits, and health probes.

import { validateKubernetesManifests } from "../validators/kubernetes.validator.js";

/**
 * Sanitizes project name to comply with Kubernetes DNS subdomain name requirements.
 *
 * @param {string} name
 * @returns {string}
 */
function sanitizeK8sName(name) {
  if (!name || typeof name !== "string") return "archmind-app";
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return sanitized || "archmind-app";
}

/**
 * Generates deterministic Kubernetes manifests for the application.
 *
 * @param {Object} context - Collected repository DevOps context
 * @param {Object} [options]
 * @returns {string} Multi-document Kubernetes YAML string
 */
export function generateDeterministicKubernetes(context, options = {}) {
  const appName = sanitizeK8sName(context.projectName);
  const port = context.port || 3000;
  const replicas = options.replicas || 2;
  const imagePlaceholder = options.image || `IMAGE_REGISTRY/${appName}:latest`;
  const includeIngress = Boolean(options.includeKubernetesIngress);
  const healthEndpoint = context.healthEndpoint || null;

  // Filter non-sensitive environment variables for ConfigMap
  const configMapVars = (context.envVarNames || [])
    .filter((k) => !/secret|key|password|token|auth|cred|uri/i.test(k))
    .slice(0, 10);

  // Filter sensitive names for Secret reference
  const secretVars = (context.envVarNames || [])
    .filter((k) => /secret|key|password|token|auth|cred|uri/i.test(k))
    .slice(0, 10);

  let probesYaml = "";
  if (healthEndpoint) {
    probesYaml = `          livenessProbe:
            httpGet:
              path: ${healthEndpoint}
              port: ${port}
            initialDelaySeconds: 15
            periodSeconds: 20
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: ${healthEndpoint}
              port: ${port}
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 2
`;
  } else {
    probesYaml = `          # Readiness & Liveness probes omitted: No dedicated health endpoint found in API routes.
          # To enable, add an endpoint (e.g. /api/health) and configure httpGet probes here.
`;
  }

  // 1. ConfigMap Document
  let configMapDoc = "";
  if (configMapVars.length > 0 || !context.envVarNames?.length) {
    configMapDoc = `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${appName}-config
  labels:
    app: ${appName}
data:
  NODE_ENV: "production"
  PORT: "${port}"
${configMapVars.map((v) => `  ${v}: "PLACEHOLDER_${v}"`).join("\n")}
---
`;
  }

  // 2. Deployment Document
  const deploymentDoc = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${appName}
  labels:
    app: ${appName}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${appName}
  template:
    metadata:
      labels:
        app: ${appName}
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
        - name: ${appName}
          image: ${imagePlaceholder}
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: ${port}
              protocol: TCP
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: false
            capabilities:
              drop:
                - ALL
${probesYaml}          envFrom:
            - configMapRef:
                name: ${appName}-config
${
  secretVars.length > 0
    ? `            - secretRef:
                name: ${appName}-secrets
`
    : `          # envFrom:
          #   - secretRef:
          #       name: ${appName}-secrets
`
}---
`;

  // 3. Service Document
  const serviceDoc = `apiVersion: v1
kind: Service
metadata:
  name: ${appName}-service
  labels:
    app: ${appName}
spec:
  type: ClusterIP
  selector:
    app: ${appName}
  ports:
    - name: http
      port: 80
      targetPort: ${port}
      protocol: TCP
`;

  // 4. Optional Ingress Document
  let ingressDoc = "";
  if (includeIngress) {
    const domain = options.domain || `${appName}.example.com`;
    ingressDoc = `---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${appName}-ingress
  labels:
    app: ${appName}
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
    - host: ${domain}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${appName}-service
                port:
                  number: 80
`;
  }

  return `# Generated by ArchMind AI (Phase 5: DevOps Intelligence)
# Kubernetes Production Manifests for ${context.projectName}

${configMapDoc}${deploymentDoc}${serviceDoc}${ingressDoc}`;
}

/**
 * Generates repository-grounded Kubernetes manifests using Groq LLM or deterministic fallback.
 *
 * @param {Object} context - Collected repository DevOps context
 * @param {Object} [options]
 * @param {Object} [groqService] - Optional GroqChatService instance
 * @returns {Promise<{
 *   filePath: string,
 *   content: string,
 *   validation: Object,
 *   metadata: Object
 * }>}
 */
export async function generateKubernetesManifests(context, options = {}, groqService = null) {
  const hasExisting = Boolean(context.existingK8s?.length > 0);
  const existingPath = hasExisting ? context.existingK8s[0] : null;
  const filePath = "k8s/deployment.yaml";

  // Check if repository context is sufficient for Kubernetes
  if (context.primaryLanguage === "Unknown" && !context.port && !context.entryPoint) {
    const reason =
      "Application repository lacks sufficient runtime and entry point evidence to generate reliable Kubernetes manifests.";
    return {
      filePath,
      content: `# Kubernetes Generation Skipped\n# Reason: ${reason}\n`,
      validation: {
        valid: false,
        errors: [reason],
        warnings: [],
        checks: [{ name: "context_sufficiency", passed: false, message: reason }],
        validationLevel: "structural",
      },
      metadata: {
        skipped: true,
        reason,
        hasExistingArtifact: hasExisting,
        existingFilePath: existingPath,
        targetPlatform: "kubernetes",
        provider: "none",
        options,
      },
    };
  }

  let content = "";
  let provider = "deterministic";

  if (groqService && options.useAi !== false) {
    try {
      const appName = sanitizeK8sName(context.projectName);
      const port = context.port || 3000;
      const prompt = `You are a Principal Cloud Architect creating production Kubernetes manifests (multi-document YAML separated by '---') for an analyzed repository.
Strictly adhere to the following evidence:
- Application Name: ${appName}
- Container Port: ${port}
- Health Endpoint: ${context.healthEndpoint || "none"}
- Database: ${context.databaseType || "none"}
- Environment Variables: ${JSON.stringify(context.envVarNames || [])}

Rules:
1. Output ONLY the raw multi-document YAML (Deployment, Service, ConfigMap). No conversational commentary, no markdown code wrappers.
2. Deployment:
   - MatchLabels MUST be 'app: ${appName}' and match pod template labels exactly.
   - Set containerPort: ${port}.
   - Resource requests and limits (cpu & memory).
   - runAsNonRoot: true in securityContext.
   - If health endpoint is '${context.healthEndpoint || "none"}' (not none), add liveness and readiness httpGet probes on port ${port}.
3. Service:
   - Type: ClusterIP.
   - Selector MUST be 'app: ${appName}'.
   - Port 80 targeting targetPort ${port}.
4. ConfigMap:
   - Name: ${appName}-config.
   - Include non-sensitive configs like NODE_ENV: production and PORT: "${port}".
5. NEVER invent credentials or put raw secrets in YAML. Reference secretRef: ${appName}-secrets for sensitive vars.`;

      const response = await groqService.chat({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });

      let rawText = response?.message?.content || "";
      if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:yaml|yml)?\s*/i, "").replace(/\s*```$/i, "").trim();
      }

      if (rawText && rawText.includes("kind: Deployment") && rawText.includes("kind: Service")) {
        content = rawText;
        provider = "groq";
      }
    } catch {
      // Fallback safely to deterministic generator
    }
  }

  if (!content) {
    content = generateDeterministicKubernetes(context, options);
    provider = "deterministic";
  }

  // Run deterministic validation
  const validation = validateKubernetesManifests(content, options);

  return {
    filePath,
    content,
    validation,
    metadata: {
      appName: sanitizeK8sName(context.projectName),
      port: context.port || 3000,
      hasHealthEndpoint: Boolean(context.healthEndpoint),
      healthEndpoint: context.healthEndpoint,
      hasExistingArtifact: hasExisting,
      existingFilePath: existingPath,
      targetPlatform: "kubernetes",
      provider,
      options,
    },
  };
}

