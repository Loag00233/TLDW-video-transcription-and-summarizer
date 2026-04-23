export type LLMProvider = "groq" | "deepseek" | "gemini" | "anthropic" | "ollama";

export interface ProviderConfig {
  baseURL?: string;
  defaultModel: string;
  label: string;
  free: boolean;
  signupUrl: string;
  keyRequired: boolean;
}

export const PROVIDERS: Record<LLMProvider, ProviderConfig> = {
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    label: "Groq (Llama 3.3 70B)",
    free: true,
    signupUrl: "https://console.groq.com",
    keyRequired: true,
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    label: "DeepSeek V3",
    free: false,
    signupUrl: "https://platform.deepseek.com",
    keyRequired: true,
  },
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.0-flash",
    label: "Google Gemini 2.0 Flash",
    free: true,
    signupUrl: "https://aistudio.google.com",
    keyRequired: true,
  },
  anthropic: {
    defaultModel: "claude-sonnet-4-6",
    label: "Anthropic Claude Sonnet",
    free: false,
    signupUrl: "https://console.anthropic.com",
    keyRequired: true,
  },
  ollama: {
    baseURL: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    label: "Ollama (local, free)",
    free: true,
    signupUrl: "https://ollama.com",
    keyRequired: false,
  },
};

export const PROVIDER_LIST: LLMProvider[] = ["groq", "gemini", "deepseek", "anthropic", "ollama"];
