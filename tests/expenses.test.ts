import assert from "node:assert/strict"
import test from "node:test"
import {
  calculateMonthlyCloseSnapshot,
  getBusinessPaymentMethod,
  getTransferPaymentMethods,
  sumExpenseOutflow,
  sumNetAmount,
  sumNetAmountByPaymentMethod,
  sumTransfers
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
  },
  {
    id: "transfer-cash-kpay",
    type: "business",
    kind: "transfer",
    transferFromPaymentMethod: "cash",
    transferToPaymentMethod: "kpay",
    amount: 200,
    paidByUserId: "user-a",
    ownerUserId: "user-a",
    date: "2026-05-09",
    note: "Move cash to KPay"
  }
]

test("business cash and kpay balances are calculated independently", () => {
  assert.equal(sumNetAmountByPaymentMethod(expenses, "cash"), 550)
  assert.equal(sumNetAmountByPaymentMethod(expenses, "kpay"), 800)
})

test("older business records default to cash", () => {
  const [legacyExpense] = expenses

  assert.equal(getBusinessPaymentMethod({ ...legacyExpense, paymentMethod: undefined }), "cash")
})

test("transfers move balance between payment methods without changing net", () => {
  const transfer = expenses.find((expense) => expense.kind === "transfer")

  assert.ok(transfer)
  assert.deepEqual(getTransferPaymentMethods(transfer), { from: "cash", to: "kpay" })
  assert.equal(sumNetAmount([transfer]), 0)
  assert.equal(sumTransfers(expenses), 200)
  assert.equal(sumExpenseOutflow(expenses), 350)
})

test("monthly close snapshot captures opening and closing balances", () => {
  const snapshot = calculateMonthlyCloseSnapshot(
    [
      {
        id: "april-cash",
        type: "business",
        kind: "income",
        paymentMethod: "cash",
        amount: 1000,
        paidByUserId: "user-a",
        ownerUserId: "user-a",
        date: "2026-04-30",
        note: "April cash"
      },
      ...expenses
    ],
    "2026-05"
  )

  assert.equal(snapshot.cashOpeningBalance, 1000)
  assert.equal(snapshot.kpayOpeningBalance, 0)
  assert.equal(snapshot.cashClosingBalance, 1550)
  assert.equal(snapshot.kpayClosingBalance, 800)
  assert.equal(snapshot.incomeTotal, 1700)
  assert.equal(snapshot.expenseTotal, 350)
  assert.equal(snapshot.transferTotal, 200)
  assert.equal(snapshot.transactionCount, 5)
})
