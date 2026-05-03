import type { DemoCredential, Expense, User } from "./types"

export const users: User[] = [
  {
    id: "aurora",
    name: "Aurora",
    email: "aurora@example.com"
  },
  {
    id: "brother",
    name: "Brother",
    email: "brother@example.com"
  }
]

export const demoCredentials: DemoCredential[] = [
  {
    userId: "aurora",
    email: "aurora@example.com",
    password: "split1234"
  },
  {
    userId: "brother",
    email: "brother@example.com",
    password: "brother1234"
  }
]

export const initialExpenses: Expense[] = [
  {
    id: "exp-1",
    type: "business",
    kind: "expense",
    amount: 128,
    paidByUserId: "aurora",
    ownerUserId: "aurora",
    date: "2026-05-04",
    note: "Packaging supplies"
  },
  {
    id: "exp-2",
    type: "business",
    kind: "expense",
    amount: 64,
    paidByUserId: "brother",
    ownerUserId: "brother",
    date: "2026-05-03",
    note: "Fuel for delivery"
  },
  {
    id: "exp-3",
    type: "personal",
    kind: "expense",
    amount: 18.5,
    paidByUserId: "aurora",
    ownerUserId: "aurora",
    date: "2026-05-04",
    note: "Lunch"
  },
  {
    id: "exp-4",
    type: "personal",
    kind: "expense",
    amount: 11.25,
    paidByUserId: "brother",
    ownerUserId: "brother",
    date: "2026-05-02",
    note: "Coffee"
  },
  {
    id: "exp-5",
    type: "personal",
    kind: "expense",
    amount: 42,
    paidByUserId: "aurora",
    ownerUserId: "aurora",
    date: "2026-05-01",
    note: "Phone top-up"
  },
  {
    id: "exp-6",
    type: "personal",
    kind: "expense",
    amount: 27.75,
    paidByUserId: "brother",
    ownerUserId: "brother",
    date: "2026-05-04",
    note: "Dinner"
  }
]
