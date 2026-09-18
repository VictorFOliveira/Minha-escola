import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonthsPreservingDay,
  calculateDiscount,
  getChargeStatus,
  roundMoney,
} from "../../lib/finance";

test("roundMoney avoids floating point residue", () => {
  assert.equal(roundMoney(10.005), 10.01);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

test("calculateDiscount combines fixed and percentage benefits without going below zero", () => {
  const dueDate = new Date("2026-09-10T12:00:00.000Z");

  assert.equal(
    calculateDiscount(1000, dueDate, [
      { active: true, valueType: "PERCENTAGE", value: 10 },
      { active: true, valueType: "FIXED", value: 50 },
    ]),
    150,
  );

  assert.equal(
    calculateDiscount(100, dueDate, [
      { active: true, valueType: "FIXED", value: 500 },
    ]),
    100,
  );
});

test("calculateDiscount respects benefit validity windows", () => {
  const dueDate = new Date("2026-09-10T12:00:00.000Z");

  assert.equal(
    calculateDiscount(1000, dueDate, [
      {
        active: true,
        valueType: "PERCENTAGE",
        value: 20,
        startsAt: new Date("2026-10-01T12:00:00.000Z"),
      },
      {
        active: true,
        valueType: "FIXED",
        value: 80,
        endsAt: new Date("2026-08-31T12:00:00.000Z"),
      },
    ]),
    0,
  );
});

test("addMonthsPreservingDay clamps the due day to the last day of month", () => {
  const initial = new Date("2026-01-31T12:00:00.000Z");
  assert.equal(
    addMonthsPreservingDay(initial, 1, 31).toISOString(),
    "2026-02-28T12:00:00.000Z",
  );
});

test("getChargeStatus preserves terminal states and recognizes partial/paid", () => {
  const future = new Date(Date.now() + 86_400_000);

  assert.equal(
    getChargeStatus({
      amount: 100,
      paidAmount: 0,
      dueDate: future,
      currentStatus: "CANCELLED",
    }),
    "CANCELLED",
  );
  assert.equal(
    getChargeStatus({
      amount: 100,
      paidAmount: 20,
      dueDate: future,
    }),
    "PARTIAL",
  );
  assert.equal(
    getChargeStatus({
      amount: 100,
      paidAmount: 100,
      dueDate: future,
    }),
    "PAID",
  );
});
