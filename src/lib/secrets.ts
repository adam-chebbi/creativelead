import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export type SecretKey =
  | `org/${string}/ai/openai`
  | `org/${string}/ai/gemini`
  | `org/${string}/smtp`
  | `org/${string}/twilio`
  | `org/${string}/google-sheets`;

function getSharedFallback(key: SecretKey): string | null {
  if (key.endsWith("ai/openai")) return process.env.SHARED_OPENAI_API_KEY ?? null;
  if (key.endsWith("ai/gemini")) return process.env.SHARED_GEMINI_API_KEY ?? null;
  return null;
}

function parseSecretKey(key: SecretKey): { workspaceId: string; secretKey: string } {
  const parts = key.split("/");
  return { workspaceId: parts[1], secretKey: parts.slice(2).join("/") };
}

export async function getSecret(key: SecretKey): Promise<string | null> {
  const { workspaceId, secretKey } = parseSecretKey(key);
  const row = await prisma.workspaceSecret.findUnique({
    where: { workspaceId_key: { workspaceId, key: secretKey } },
  });
  if (row) return decrypt(row.encryptedValue);
  return getSharedFallback(key);
}

export function maskSecret(value: string | null): string | null {
  if (!value || value.length < 4) return null;
  return `\u2022\u2022\u2022\u2022${value.slice(-4)}`;
}

export async function hasSecret(key: SecretKey): Promise<boolean> {
  const value = await getSecret(key);
  return value !== null && value.length > 0;
}

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  const { workspaceId, secretKey } = parseSecretKey(key);
  const encryptedValue = encrypt(value);
  await prisma.workspaceSecret.upsert({
    where: { workspaceId_key: { workspaceId, key: secretKey } },
    update: { encryptedValue },
    create: { workspaceId, key: secretKey, encryptedValue },
  });
}
