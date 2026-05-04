# SplitLedger - Full Plan

## Overview
SplitLedger is a mobile-first transaction tracking web app for three users.

- Shared **Business transactions**
- Separate **Personal transactions**
- Individual login accounts
- Real-time balance calculation

---

## Core Features (MVP)

### 1. Authentication
- Email + password login
- Each user has their own account

### 2. Business Expenses (Shared)
- Both users can:
  - Add
  - View
  - Edit
- Default split: 50/50
- Tracks:
  - Who paid
  - Who owes

### 3. Personal Expenses (Private)
- Each user:
  - Sees only their own personal expenses
- No sharing
- No split

### 4. Dashboard
- Today’s spending
- Monthly totals
- Balance:
  - Who owes who

### 5. Add Expense
Fields:
- Amount
- Type: Business / Personal
- Paid by
- Owner (for personal)
- Date (default: today)
- Note

---

## UX Structure

### Mobile Navigation (Bottom)
- Home
- Business
- Personal
- Add
- Reports

### Desktop (Sidebar)
- Left sidebar navigation
- Center content
- Right summary panel

---

## Pages

### 1. Home
- Summary cards
- Balance status
- Recent transactions

### 2. Business
- Shared expense list
- Balance calculation
- Filter by date

### 3. Personal
- Only current user’s data
- Monthly totals

### 4. Add Expense
- Bottom sheet modal
- Default today date

### 5. Reports (v2)
- Charts
- Trends

---

## Database Design

### users
- id
- name
- email

### workspaces
- id
- name

### workspace_members
- workspace_id
- user_id

### expenses
- id
- workspace_id
- type (business/personal)
- amount
- paid_by_user_id
- owner_user_id
- date
- note
- created_at

---

## Core Logic

### Business
- Visible to both users
- Split 50/50
- Balance updates automatically

### Personal
- Visible only to owner
- No split

---

## Tech Stack

- Next.js
- Supabase (auth + database)
- Tailwind CSS
- PWA support

---

## Design Guidelines

- Mobile-first
- Large tap targets
- Clean UI
- iOS-style layout
- Rounded cards
- Simple colors:
  - Business: Blue
  - Personal: Green
  - Owed: Red/Orange

---

## Future Features

- Receipt upload
- Custom split ratios
- Notifications
- Export CSV
- Multi-user groups

---

## Recommendation

Start simple:
1. Auth
2. Add expense
3. Shared business logic
4. Personal tracking
5. Balance calculation

Then improve.
