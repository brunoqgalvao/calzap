export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function phoneToUserId(phone: string): number {
  const normalized = normalizePhoneNumber(phone);
  const id = Number.parseInt(normalized, 10);

  if (!Number.isSafeInteger(id)) {
    throw new Error(`Invalid WhatsApp phone number: ${phone}`);
  }

  return id;
}
