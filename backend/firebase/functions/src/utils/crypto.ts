import { createHash } from "crypto";

export function canonicalStringify(obj: any): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`);
  return "{" + pairs.join(",") + "}";
}

export function deriveOperationId(
  actorUid: string,
  action: string,
  targetType: string,
  targetId: string,
  idempotencyKey: string
): string {
  const obj = {
    action,
    actorUid,
    idempotencyKey,
    targetId,
    targetType,
  };
  return createHash("sha256").update(canonicalStringify(obj)).digest("hex");
}

export function deriveRequestFingerprint(input: any): string {
  return createHash("sha256").update(canonicalStringify(input)).digest("hex");
}
