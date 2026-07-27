import type { LedgerItem } from "./finance";

export type DemoChild = {
  id: string;
  name: string;
  initials: string;
  email: string;
  purpose: string;
  rate: number;
  balanceReminderDay?: number | null;
  accent: string;
  entries: LedgerItem[];
};

export const demoChildren: DemoChild[] = [
  {
    id: "olivia",
    name: "Olivia Bennett",
    initials: "OB",
    email: "olivia@demo.family",
    purpose: "First home down payment",
    rate: 3.75,
    accent: "#2E7D32",
    entries: [
      { id: "o1", date: "2025-12-05", type: "Loan", description: "Initial home loan", amount: 42000, rate: 3.75 },
      { id: "o2", date: "2026-01-05", type: "Interest", description: "December interest · 31 days", amount: 133.77, rate: 3.75 },
      { id: "o3", date: "2026-01-18", type: "Payment", description: "Monthly payment", amount: -600, rate: null },
      { id: "o4", date: "2026-02-05", type: "Interest", description: "January interest · 31 days", amount: 132.28, rate: 3.75 },
      { id: "o5", date: "2026-02-18", type: "Payment", description: "Monthly payment", amount: -600, rate: null },
      { id: "o6", date: "2026-03-05", type: "Interest", description: "February interest · 28 days", amount: 119.76, rate: 3.75 },
      { id: "o7", date: "2026-03-18", type: "Payment", description: "Monthly payment", amount: -700, rate: null },
      { id: "o8", date: "2026-04-05", type: "Interest", description: "March interest · 31 days", amount: 128.04, rate: 3.75 },
      { id: "o9", date: "2026-04-18", type: "Payment", description: "Monthly payment", amount: -700, rate: null },
      { id: "o10", date: "2026-05-05", type: "Interest", description: "April interest · 30 days", amount: 121.52, rate: 3.75 },
      { id: "o11", date: "2026-05-18", type: "Payment", description: "Monthly payment", amount: -700, rate: null },
      { id: "o12", date: "2026-06-05", type: "Interest", description: "May interest · 31 days", amount: 123.96, rate: 3.75 },
      { id: "o13", date: "2026-06-18", type: "Payment", description: "Monthly payment", amount: -700, rate: null },
      { id: "o14", date: "2026-07-05", type: "Interest", description: "June interest · 30 days", amount: 116.15, rate: 3.75 },
      { id: "o15", date: "2026-07-18", type: "Payment", description: "Monthly payment", amount: -800, rate: null },
    ],
  },
  {
    id: "ethan",
    name: "Ethan Bennett",
    initials: "EB",
    email: "ethan@demo.family",
    purpose: "Graduate school",
    rate: 4.25,
    accent: "#D4AF37",
    entries: [
      { id: "e1", date: "2026-01-12", type: "Loan", description: "Spring tuition", amount: 18000, rate: 4.25 },
      { id: "e2", date: "2026-02-05", type: "Interest", description: "January interest · 24 days", amount: 50.30, rate: 4.25 },
      { id: "e3", date: "2026-03-05", type: "Interest", description: "February interest · 28 days", amount: 58.85, rate: 4.25 },
      { id: "e4", date: "2026-03-20", type: "Payment", description: "Teaching stipend payment", amount: -300, rate: null },
      { id: "e5", date: "2026-04-05", type: "Interest", description: "March interest · 31 days", amount: 58.85, rate: 4.25 },
      { id: "e6", date: "2026-05-05", type: "Interest", description: "April interest · 30 days", amount: 56.84, rate: 4.25 },
      { id: "e7", date: "2026-05-20", type: "Payment", description: "Teaching stipend payment", amount: -300, rate: null },
      { id: "e8", date: "2026-06-05", type: "Interest", description: "May interest · 31 days", amount: 57.46, rate: 4.25 },
      { id: "e9", date: "2026-07-05", type: "Interest", description: "June interest · 30 days", amount: 55.11, rate: 4.25 },
    ],
  },
  {
    id: "maya",
    name: "Maya Bennett",
    initials: "MB",
    email: "maya@demo.family",
    purpose: "Small business launch",
    rate: 3.25,
    accent: "#81C784",
    entries: [
      { id: "m1", date: "2026-02-02", type: "Loan", description: "Studio equipment", amount: 12500, rate: 3.25 },
      { id: "m2", date: "2026-03-05", type: "Interest", description: "February interest · 31 days", amount: 34.51, rate: 3.25 },
      { id: "m3", date: "2026-03-28", type: "Loan", description: "Initial inventory", amount: 3200, rate: 3.25 },
      { id: "m4", date: "2026-04-05", type: "Interest", description: "March interest · 31 days", amount: 43.29, rate: 3.25 },
      { id: "m5", date: "2026-04-25", type: "Payment", description: "First sales payment", amount: -450, rate: null },
      { id: "m6", date: "2026-05-05", type: "Interest", description: "April interest · 30 days", amount: 41.91, rate: 3.25 },
      { id: "m7", date: "2026-05-25", type: "Payment", description: "Monthly payment", amount: -450, rate: null },
      { id: "m8", date: "2026-06-05", type: "Interest", description: "May interest · 31 days", amount: 41.25, rate: 3.25 },
      { id: "m9", date: "2026-06-25", type: "Payment", description: "Monthly payment", amount: -500, rate: null },
      { id: "m10", date: "2026-07-05", type: "Interest", description: "June interest · 30 days", amount: 38.50, rate: 3.25 },
    ],
  },
];
