export const APP_ROLES = [
  "ADMIN",
  "COORDINATOR",
  "SECRETARY",
  "TEACHER",
  "FINANCE",
  "STUDENT",
  "GUARDIAN",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrador",
  COORDINATOR: "Coordenação",
  SECRETARY: "Secretaria",
  TEACHER: "Professor",
  FINANCE: "Financeiro",
  STUDENT: "Aluno",
  GUARDIAN: "Responsável",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  ADMIN: "Acesso total à escola e gestão de usuários.",
  COORDINATOR: "Gestão acadêmica, avaliações, acompanhamento e turmas.",
  SECRETARY: "Alunos, matrículas, turmas e frequência.",
  TEACHER: "Turmas, frequência e recursos acadêmicos.",
  FINANCE: "Cobranças, recebimentos e indicadores financeiros.",
  STUDENT: "Portal pessoal: grade, horários, frequência, notas e comunicados.",
  GUARDIAN: "Portal dos alunos vinculados: acadêmico, financeiro e comunicação.",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function homePathForRole(role: AppRole) {
  if (role === "STUDENT") return "/portal/aluno";
  if (role === "GUARDIAN") return "/portal/responsavel";
  return "/dashboard";
}

export const BACKOFFICE_ROLES: AppRole[] = [
  "ADMIN",
  "COORDINATOR",
  "SECRETARY",
  "TEACHER",
  "FINANCE",
];
