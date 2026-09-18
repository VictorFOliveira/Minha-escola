import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_ROLES,
  BACKOFFICE_ROLES,
  homePathForRole,
  isAppRole,
} from "../../lib/permissions";
import { canCreateAudience } from "../../lib/communication";
import type { SessionUser } from "../../lib/session";

function session(role: SessionUser["role"]): SessionUser {
  return {
    id: "user-test",
    schoolId: "school-test",
    schoolName: "Escola Teste",
    name: "Teste",
    email: "teste@example.invalid",
    role,
  };
}

test("all expected roles are recognized", () => {
  assert.deepEqual(APP_ROLES, [
    "ADMIN",
    "COORDINATOR",
    "SECRETARY",
    "TEACHER",
    "FINANCE",
    "STUDENT",
    "GUARDIAN",
  ]);
  assert.equal(isAppRole("ADMIN"), true);
  assert.equal(isAppRole("SUPERADMIN"), false);
});

test("students and guardians are isolated from backoffice", () => {
  assert.equal(BACKOFFICE_ROLES.includes("STUDENT"), false);
  assert.equal(BACKOFFICE_ROLES.includes("GUARDIAN"), false);
  assert.equal(homePathForRole("STUDENT"), "/portal/aluno");
  assert.equal(homePathForRole("GUARDIAN"), "/portal/responsavel");
});

test("teacher cannot broadcast to the whole school", () => {
  assert.equal(canCreateAudience(session("TEACHER"), "SCHOOL"), false);
  assert.equal(canCreateAudience(session("TEACHER"), "STAFF"), false);
  assert.equal(canCreateAudience(session("TEACHER"), "CLASS_BOTH"), true);
});

test("finance can only communicate with financial/individual guardians", () => {
  assert.equal(
    canCreateAudience(session("FINANCE"), "FINANCIAL_GUARDIANS"),
    true,
  );
  assert.equal(
    canCreateAudience(session("FINANCE"), "INDIVIDUAL_GUARDIAN"),
    true,
  );
  assert.equal(canCreateAudience(session("FINANCE"), "STUDENTS"), false);
  assert.equal(canCreateAudience(session("FINANCE"), "SCHOOL"), false);
});

test("students and guardians cannot create communications", () => {
  assert.equal(canCreateAudience(session("STUDENT"), "CLASS_BOTH"), false);
  assert.equal(canCreateAudience(session("GUARDIAN"), "GUARDIANS"), false);
});
