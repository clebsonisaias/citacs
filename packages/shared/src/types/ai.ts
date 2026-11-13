export type AiProvider = 'openai' | 'gemini' | 'anthropic' | 'custom';

export interface AiSuggestedAction {
  id: string;
  title: string;
  description: string;
  commandType: string;
  parameters: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AiDiagnosticResult {
  summary: string;
  severity: 'healthy' | 'info' | 'warning' | 'critical';
  identifiedIssues: string[];
  rootCauseAnalysis: string;
  suggestedActions: AiSuggestedAction[];
  generatedReport: string;
  analyzedAt: string;
}

export interface AiChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedActions?: AiSuggestedAction[];
}
