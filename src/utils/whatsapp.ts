export function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('test-')) {
    return trimmed;
  }

  return trimmed.replace(/\D/g, '');
}

export function phoneToUserId(phone: string): number {
  const normalized = normalizePhoneNumber(phone);

  if (normalized.startsWith('test-')) {
    return hashTestNumber(normalized);
  }

  const id = Number.parseInt(normalized, 10);

  if (!Number.isSafeInteger(id)) {
    throw new Error(`Invalid WhatsApp phone number: ${phone}`);
  }

  return id;
}

function hashTestNumber(phone: string): number {
  let hash = 0;

  for (const char of phone) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  }

  return 900000000000000 + hash;
}
