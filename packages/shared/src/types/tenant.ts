export type UserRole = 'superadmin' | 'tenant_admin' | 'technician' | 'support_agent' | 'readonly';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  document: string; // CNPJ / CPF
  plan: 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  cpeLimit: number;
  contactEmail: string;
  telegramChatId?: string;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}
