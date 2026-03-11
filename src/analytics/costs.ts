export interface AiUsageSnapshot {
  model: string;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  audioInputTokens?: number | null;
}

interface ModelPricing {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
  audioInputPerMillion?: number;
}

const GPT_41_MINI_PRICING: ModelPricing = {
  inputPerMillion: 0.4,
  cachedInputPerMillion: 0.1,
  outputPerMillion: 1.6,
};

const GPT_5_PRICING: ModelPricing = {
  inputPerMillion: 1.25,
  cachedInputPerMillion: 0.125,
  outputPerMillion: 10,
};

const GPT_4O_TRANSCRIBE_PRICING: ModelPricing = {
  inputPerMillion: 3,
  cachedInputPerMillion: 3,
  outputPerMillion: 12,
  audioInputPerMillion: 3,
};

function getModelPricing(model: string): ModelPricing | null {
  if (model === 'gpt-4.1-mini') {
    return GPT_41_MINI_PRICING;
  }

  if (model === 'gpt-4o-transcribe') {
    return GPT_4O_TRANSCRIBE_PRICING;
  }

  if (model.startsWith('gpt-5.2')) {
    return GPT_5_PRICING;
  }

  if (model.startsWith('gpt-5')) {
    return GPT_5_PRICING;
  }

  return null;
}

export function estimateOpenAICostUsd(snapshot: AiUsageSnapshot): number | null {
  const pricing = getModelPricing(snapshot.model);
  if (!pricing) {
    return null;
  }

  const totalInputTokens = snapshot.inputTokens ?? 0;
  const cachedInputTokens = snapshot.cachedInputTokens ?? 0;
  const audioInputTokens = snapshot.audioInputTokens ?? 0;
  const outputTokens = snapshot.outputTokens ?? 0;
  const billableInputTokens = Math.max(totalInputTokens - cachedInputTokens - audioInputTokens, 0);

  const total =
    (billableInputTokens / 1_000_000) * pricing.inputPerMillion +
    (cachedInputTokens / 1_000_000) * pricing.cachedInputPerMillion +
    (audioInputTokens / 1_000_000) * (pricing.audioInputPerMillion ?? pricing.inputPerMillion) +
    (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return Math.round(total * 1_000_000) / 1_000_000;
}
