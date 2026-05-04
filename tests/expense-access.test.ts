import assert from "node:assert/strict"
import test from "node:test"
import {
  buildAccessibleExpenseFilter,
  buildVisibleExpenseFilter,
  canAccessExpense
} from "../lib/server/expense-access.ts"

test("business records are visible to every authenticated user", () => {
  assert.equal(canAccessExpense({ type: "business", ownerUserId: "user-a" }, "user-b"), true)
})

test("personal records are only visible to the owner", () => {
  assert.equal(canAccessExpense({ type: "personal", ownerUserId: "user-a" }, "user-a"), true)
  assert.equal(canAccessExpense({ type: "personal", ownerUserId: "user-a" }, "user-b"), false)
})

test("visible expense filter includes business and owned personal records", () => {
  assert.deepEqual(buildVisibleExpenseFilter("user-a"), {
    $or: [{ type: "business" }, { type: "personal", ownerUserId: "user-a" }]
  })
})

test("accessible expense filter scopes delete/read by id and user visibility", () => {
  assert.deepEqual(buildAccessibleExpenseFilter("expense-1", "user-a"), {
    id: "expense-1",
    $or: [{ type: "business" }, { type: "personal", ownerUserId: "user-a" }]
  })
})
