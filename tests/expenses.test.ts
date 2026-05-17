import assert from "node:assert/strict"
import test from "node:test"
import {
  getBusinessPaymentMethod,
  sumNetAmountByPaymentMethod
} from "../lib/expenses.ts"
import type { Expense } from "../lib/types.ts"

const expenses: Expense[] = [
  {
    id: "income-cash",
    type: "business",
    kind: "income",
    paymentMethod: "cash",
    amount: 1000,
    paidByUserId: "user-a",
    ownerUserId: "user-a",
    date: "2026-05-08",
    note: "Cash sale"
  },
  {
    id: "expense-cash",
    type: "business",
    kind: "expense",
    paymentMethod: "cash",
    amount: 250,
    paidByUserId: "user-a",
    ownerUserId: "user-a",
    date: "2026-05-08",
    note: "Cash supplies"
  },
  {
    id: "income-kpay",
    type: "business",
    kind: "income",
    paymentMethod: "kpay",
    amount: 700,
    paidByUserId: "user-a",
    ownerUserId: "user-a",
    date: "2026-05-08",
    note: "KPay sale"
  },
  {
    id: "expense-kpay",
    type: "business",
    kind: "expense",
    paymentMethod: "kpay",
    amount: 100,
    paidByUserId: "user-a",
    ownerUserId: "user-a",
    date: "2026-05-08",
    note: "KPay transfer"
  }
]

test("business cash and kpay balances are calculated independently", () => {
  assert.equal(sumNetAmountByPaymentMethod(expenses, "cash"), 750)
  assert.equal(sumNetAmountByPaymentMethod(expenses, "kpay"), 600)
})

test("older business records default to cash", () => {
  const [legacyExpense] = expenses

  assert.equal(getBusinessPaymentMethod({ ...legacyExpense, paymentMethod: undefined }), "cash")
})
