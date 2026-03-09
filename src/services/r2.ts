export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await bucket.put(key, data, {
    httpMetadata: { contentType },
  });
}

export function photoKey(userId: number, date: string): string {
  const uuid = crypto.randomUUID();
  return `photos/${userId}/${date}/${uuid}.jpg`;
}

export function audioKey(userId: number, date: string): string {
  const uuid = crypto.randomUUID();
  return `audio/${userId}/${date}/${uuid}.ogg`;
}

function todayISO(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function photoKeyToday(userId: number): string {
  return photoKey(userId, todayISO());
}

export function audioKeyToday(userId: number): string {
  return audioKey(userId, todayISO());
}
