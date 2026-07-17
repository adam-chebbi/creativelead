/**
 * Secrets abstraction layer.
 *
 * Today: reads from process.env (works in dev + Vercel/Railway/Render).
 * Later: swap the body of `getSecret` / `setSecret` for your vault SDK
 * (Doppler, AWS Secrets Manager, HashiCorp Vault) without changing any
 * call-site.
 *
 * IMPORTANT: this module runs server-side only. Never import it from a
 * client component or expose its return values to the browser.
 */

export type SecretKey =
  | `org/${string}/ai/openai`
  | `org/${string}/ai/gemini`
  | `org/${string}/smtp`
  | `org/${string}/twilio`
  | `org/${string}/google-sheets`;

/**
 * Retrieve a secret value by key.
 * Returns `null` if the secret is not configured.
 */
export async function getSecret(key: SecretKey): Promise<string | null> {
  // Env-var form: org/acme/ai/openai → ORG_ACME_AI_OPENAI
  const envKey = key.replace(/\//g, '_').replace(/-/g, '_').toUpperCase();
  return process.env[envKey] ?? null;
}

/**
 * Mask a secret for display: returns only the last 4 characters preceded
 * by bullet placeholders, e.g.  "sk-••••••••1234".
 * Returns null if the value is falsy.
 */
export function maskSecret(value: string | null): string | null {
  if (!value || value.length < 4) return null;
  return `••••${value.slice(-4)}`;
}

/**
 * Check whether a secret is configured (without exposing its value).
 */
export async function hasSecret(key: SecretKey): Promise<boolean> {
  const value = await getSecret(key);
  return value !== null && value.length > 0;
}

/**
 * In production, writing secrets means calling your vault's SDK.
 * In development, we log a reminder — env vars must be set manually
 * (or via .env.local) since we cannot write to process.env at runtime
 * in a way that persists across restarts.
 */
export async function setSecret(key: SecretKey, value: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    // TODO: Replace with your vault SDK call, e.g.:
    // await secretsManagerClient.putSecretValue({ SecretId: key, SecretString: value });
    throw new Error(
      `[secrets] setSecret called in production but no vault SDK is configured. ` +
      `Integrate your vault SDK here (AWS Secrets Manager, Doppler, etc.).`
    );
  }
  // Dev: remind the developer to set the env var
  console.warn(
    `[secrets] DEV MODE: To set secret "${key}", add the following to your .env.local:\n` +
    `${key.replace(/\//g, '_').replace(/-/g, '_').toUpperCase()}="${value}"`
  );
}
