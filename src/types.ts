export interface Env {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  OPENAI_API_KEY: string;
  WEBHOOK_SECRET: string;
  ZAP_GATEWAY_API_KEY: string;
  ADMIN_PHONE_NUMBER: string;
  ZAP_GATEWAY_BASE_URL?: string;
  WHATSAPP_BUSINESS_NUMBER?: string;
}

// --- WhatsApp types ---

export interface WhatsAppWebhook {
  object: string;
  entry?: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes?: WhatsAppChange[];
}

export interface WhatsAppChange {
  field: string;
  value?: WhatsAppValue;
}

export interface WhatsAppValue {
  messaging_product?: string;
  metadata?: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppMetadata {
  display_phone_number?: string;
  phone_number_id?: string;
}

export interface WhatsAppContact {
  profile?: {
    name?: string;
  };
  wa_id: string;
}

export interface WhatsAppStatus {
  id: string;
  status: string;
}

export interface WhatsAppImage {
  id: string;
  caption?: string;
  mime_type?: string;
}

export interface WhatsAppAudio {
  id: string;
  mime_type?: string;
  voice?: boolean;
}

export interface WhatsAppText {
  body: string;
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: WhatsAppText;
  image?: WhatsAppImage;
  audio?: WhatsAppAudio;
}

export interface WhatsAppConversationContext {
  userId: number;
  senderPhone: string;
  businessPhone: string;
  incomingMessageId?: string;
  senderName?: string;
}

// --- OpenAI types ---

export interface FoodItem {
  nome: string;
  quantidade: string;
  calorias: number;
}

export interface FoodAnalysis {
  descricao: string;
  itens: FoodItem[];
  total_calorias: number;
  confianca: 'alta' | 'media' | 'baixa';
  observacoes: string;
}

// --- DB row types ---

export interface UserRow {
  id: number;
  first_name: string;
  username: string | null;
  daily_calorie_goal: number;
  created_at: string;
}

export interface MealRow {
  id: number;
  user_id: number;
  description: string;
  food_items: string;
  total_calories: number;
  photo_r2_key: string | null;
  audio_r2_key: string | null;
  follow_up_text: string | null;
  analysis_source: string;
  logged_at: string;
  created_at: string;
}

export type MessageRole = 'user' | 'assistant';

export interface MessageRow {
  id: number;
  user_id: number;
  role: MessageRole;
  content: string;
  created_at: string;
}
