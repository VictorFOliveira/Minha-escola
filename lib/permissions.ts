export const APP_ROLES = [
  "ADMIN",
  "SECRETARY",
  "TEACHER",
  "FINANCE",
  "GUARDIAN",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrador",
  SECRETARY: "Secretaria",
  TEACHER: "Professor",
  FINANCE: "Financeiro",
  GUARDIAN: "Responsável",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  ADMIN: "Acesso total à escola e gestão de usuários.",
  SECRETARY: "Alunos, matrículas, turmas e frequência.",
  TEACHER: "Turmas, frequência e recursos acadêmicos.",
  FINANCE: "Cobranças, recebimentos e indicadores financeiros.",
  GUARDIAN: "Acesso futuro ao portal do responsável.",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}
