import type { Expense, User } from "./types"

export const users: User[] = [
  {
    id: "t_khant_naing",
    name: "T Khant Naing",
    email: "tkhantnaing@example.com"
  },
  {
    id: "htet_myat_naing",
    name: "Htet Myat Naing",
    email: "htetmyatnaing@example.com"
  },
  {
    id: "mg_mg",
    name: "Mg Mg",
    email: "mgmg@example.com"
  }
]

export const initialExpenses: Expense[] = [
  {
    id: "exp-1",
    type: "business",
    kind: "expense",
    amount: 128,
    paidByUserId: "t_khant_naing",
    ownerUserId: "t_khant_naing",
    date: "2026-05-04",
    note: "Packaging supplies"
  },
  {
    id: "exp-2",
    type: "business",
    kind: "expense",
    amount: 64,
    paidByUserId: "htet_myat_naing",
    ownerUserId: "htet_myat_naing",
    date: "2026-05-03",
    note: "Fuel for delivery"
  },
  {
    id: "exp-3",
    type: "personal",
    kind: "expense",
    amount: 18.5,
    paidByUserId: "t_khant_naing",
    ownerUserId: "t_khant_naing",
    date: "2026-05-04",
    note: "Lunch"
  },
  {
    id: "exp-4",
    type: "personal",
    kind: "expense",
    amount: 11.25,
    paidByUserId: "htet_myat_naing",
    ownerUserId: "htet_myat_naing",
    date: "2026-05-02",
    note: "Coffee"
  },
  {
    id: "exp-5",
    type: "personal",
    kind: "expense",
    amount: 42,
    paidByUserId: "t_khant_naing",
    ownerUserId: "t_khant_naing",
    date: "2026-05-01",
    note: "Phone top-up"
  },
  {
    id: "exp-6",
    type: "personal",
    kind: "expense",
    amount: 27.75,
    paidByUserId: "mg_mg",
    ownerUserId: "mg_mg",
    date: "2026-05-04",
    note: "Dinner"
  }
]
