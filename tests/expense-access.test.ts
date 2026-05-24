import assert from "node:assert/strict"
import test from "node:test"
import {
  buildAccessibleExpenseWhere,
  buildVisibleExpenseWhere,
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
  const { clause, params } = buildVisibleExpenseWhere("user-a")
  assert.equal(clause, "(type = 'business' OR (type = 'personal' AND owner_user_id = ?))")
  assert.deepEqual(params, ["user-a"])
})

test("accessible expense filter scopes by id and user visibility", () => {
  const { clause, params } = buildAccessibleExpenseWhere("expense-1", "user-a")
  assert.equal(clause, "id = ? AND (type = 'business' OR (type = 'personal' AND owner_user_id = ?))")
  assert.deepEqual(params, ["expense-1", "user-a"])
})
