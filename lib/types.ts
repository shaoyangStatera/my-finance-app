// ─── Shared primitives ────────────────────────────────────────────────────────

export type PersonOwner = string; // family member userId

export interface CpfPersonBalance {
  oa: number;
  sa: number;
  ma: number;
}

export interface FixedExpense {
  label: string;
  amount: number;
}

export interface DiscretionaryItem {
  category: string;
  budget: number;
  spent: number;
  owner: PersonOwner;
}

export interface LedgerData {
  income: Record<string, number>; // keyed by userId
  fixedExpenses: FixedExpense[];
  discretionary: DiscretionaryItem[];
  notes: string;
}

// ─── Housing ──────────────────────────────────────────────────────────────────

export const HOUSING_TYPES = [
  'HDB BTO',
  'HDB Resale',
  'Condo',
  'Landed',
  'EC',
] as const;
export type HousingType = typeof HOUSING_TYPES[number];

export const ROOM_TYPES = [
  '2-Room',
  '3-Room',
  '4-Room',
  '5-Room',
  'Studio',
  '1-Bedroom',
  '2-Bedroom',
  '2-Bedroom with Study',
  '2-Bedroom with Store',
  '3-Bedroom',
  '3-Bedroom with Study',
  '3-Bedroom with Store',
  '4-Bedroom',
  '4-Bedroom with Yard',
  '5-Bedroom',
  'Other',
] as const;
export type RoomType = typeof ROOM_TYPES[number];

export const BTO_ROOM_TYPES: readonly RoomType[] = ['2-Room', '3-Room', '4-Room', '5-Room'];
export const HDB_RESALE_ROOM_TYPES: readonly RoomType[] = ['2-Room', '3-Room', '4-Room', '5-Room', 'Studio', 'Other'];
export const CONDO_EC_ROOM_TYPES: readonly RoomType[] = [
  '1-Bedroom',
  '2-Bedroom',
  '2-Bedroom with Study',
  '2-Bedroom with Store',
  '3-Bedroom',
  '3-Bedroom with Study',
  '3-Bedroom with Store',
  '4-Bedroom',
  '4-Bedroom with Yard',
  '5-Bedroom',
];

export function roomTypesForHousingType(housingType: HousingType | ''): readonly RoomType[] | null {
  if (housingType === 'HDB BTO') return BTO_ROOM_TYPES;
  if (housingType === 'HDB Resale') return HDB_RESALE_ROOM_TYPES;
  if (housingType === 'Condo' || housingType === 'EC') return CONDO_EC_ROOM_TYPES;
  if (housingType === 'Landed') return null; // no unit type for landed
  return HDB_RESALE_ROOM_TYPES; // fallback
}

/** BTO-specific stages */
export const BTO_STAGES = [
  'Applied for HFE',
  'Ballot application done',
  'Awaiting ballot results',
  'Wait for first appointment',
  'Wait for 2nd appointment',
  'Collection of keys',
] as const;

/** Resale / Condo / Landed stages */
export const RESALE_STAGES = [
  'Searching',
  'Made an offer',
  'OTP signed',
  'Exercise OTP',
  'Completion',
  'Keys collected',
] as const;

export type BtoStage = typeof BTO_STAGES[number];
export type ResaleStage = typeof RESALE_STAGES[number];

export const HOUSING_STAGE_EXTRAS: Record<string, 'ballot' | 'appointment' | undefined> = {
  'Awaiting ballot results': 'ballot',
  'Wait for first appointment': 'appointment',
};

export const HOUSING_STAGE_LABELS: Record<string, { pending: string; done: string }> = {
  // BTO
  'Applied for HFE':            { pending: 'Apply for HFE',              done: 'Applied for HFE' },
  'Ballot application done':    { pending: 'Submit ballot application',   done: 'Ballot application submitted' },
  'Awaiting ballot results':    { pending: 'Awaiting ballot results',     done: 'Ballot results received' },
  'Wait for first appointment': { pending: 'Waiting for 1st appointment', done: '1st appointment done' },
  'Wait for 2nd appointment':   { pending: 'Waiting for 2nd appointment', done: '2nd appointment done' },
  'Collection of keys':         { pending: 'Collect keys',                done: 'Keys collected!' },
  // Resale / Condo / Landed
  'Searching':                  { pending: 'Searching for unit',          done: 'Found the unit' },
  'Made an offer':              { pending: 'Make an offer',               done: 'Offer accepted' },
  'OTP signed':                 { pending: 'Sign Option to Purchase',     done: 'OTP signed' },
  'Exercise OTP':               { pending: 'Exercise OTP',                done: 'OTP exercised' },
  'Completion':                 { pending: 'Awaiting completion',         done: 'Completion done' },
  'Keys collected':             { pending: 'Collect keys',                done: 'Keys collected!' },
};

export interface HousingBallotExtra {
  ballotNumber: string;
  totalSupply: string;
}

export interface HousingAppointmentExtra {
  appointmentDatetime: string;
  appointmentNote: string;
}

export type HousingMilestoneExtra = HousingBallotExtra | HousingAppointmentExtra;

export interface HousingData {
  _id?: string;
  familyId: string;
  housingType: HousingType | '';
  projectName: string;
  address: string;
  roomType: RoomType | '';
  flatPrice: number;
  currentStage: string;
  nextMilestoneDate: string;
  milestoneDates: Record<string, string>;
  milestoneExtras: Record<string, HousingBallotExtra | HousingAppointmentExtra>;
  bookingFee: number;
  downpayment: number;
  subsidyClawbackRate: number;
  notes: string;
  updatedAt?: string;
}

// ─── Investments & Insurance ──────────────────────────────────────────────────

export const INVESTMENT_TYPES = ['Stocks', 'ETF', 'Crypto', 'Commodity', 'Bond', 'Other'] as const;
export type InvestmentType = typeof INVESTMENT_TYPES[number];

export interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  currency: string;
  change: number;       // absolute change
  changePct: number;    // % change
  marketState: string;
}

export interface InvestmentItem {
  id: string;
  name: string;
  type: InvestmentType;
  // stock-specific
  ticker: string;       // e.g. "AAPL", "ES3.SI"
  qty: number;          // number of shares/units
  entryPrice: number;   // price per unit at purchase
  entryDate: string;    // ISO date string
  currentPrice: number; // last fetched price per unit
  currentPriceUpdatedAt: string; // ISO datetime
  // manual override (used when type != Stocks or when ticker lookup is skipped)
  value: number;        // total current value (qty * currentPrice, or manual)
  platform: string;
  owner: PersonOwner;
}

export interface InsuranceItem {
  id: string;
  name: string;
  type: 'shield' | 'life' | 'critical_illness' | 'other';
  premium: number;
  renewalDate: string;
  coverage: string;
  owner: PersonOwner;
}

// ─── Monthly check-in ─────────────────────────────────────────────────────────

export interface MonthlyCheckin {
  _id?: string;
  familyId: string;
  monthYear: string;
  cpf: Record<string, CpfPersonBalance>; // keyed by userId
  ledger: LedgerData;
  investments: InvestmentItem[];
  insurance: InsuranceItem[];
  notes: string;
  updatedAt: string;
  updatedBy?: string;
}

// ─── Family ───────────────────────────────────────────────────────────────────

export const MEMBER_LABELS = [
  'Mother', 'Father', 'Son', 'Daughter',
  'Grandmother', 'Grandfather', 'Partner', 'Sibling', 'Other',
] as const;
export type MemberLabel = typeof MEMBER_LABELS[number];

export interface FamilyMember {
  userId: string;
  displayName: string;
  email: string;
  role: 'admin' | 'member';
  joinedAt: string;
  label?: MemberLabel | string;
}

export interface FamilyInvite {
  userId: string;
  displayName: string;
  email: string;
  requestedAt: string;
}

export interface Family {
  _id: string;
  name: string;
  inviteCode: string;
  members: FamilyMember[];
  pendingRequests: FamilyInvite[];
  memberLabels?: Record<string, string>;
  createdAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface NotificationPrefs {
  cpf: boolean;
  investment: boolean;
  expense: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  cpf: true,
  investment: true,
  expense: true,
};

export interface AppNotification {
  _id: string;
  familyId: string;
  actorUserId: string;
  actorName: string;
  type: 'cpf' | 'investment' | 'expense';
  message: string;
  createdAt: string;
  readBy: string[];
}

export interface User {
  _id: string;
  email: string;
  displayName: string;
  familyId?: string;
  familyRole?: 'admin' | 'member';
  onboardingComplete?: boolean;
  notificationPrefs?: NotificationPrefs;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterResponse {
  pendingToken: string;
  purpose: 'email_verify';
  otpSent: true;
  user: { _id: string; email: string; displayName: string };
}

export interface LoginStepOneResponse {
  pendingToken: string;
  purpose: 'login' | 'password_reset';
  otpSent: true;
  user: User;
  message?: string;
  requiresOtp?: true;
  requiresPasswordReset?: true;
}

export interface ApiErrorBody {
  error: string;
  retryAfterSeconds?: number;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Returns the display name for a given owner/userId key.
 * Falls back to the key itself for any unknown userId (e.g. new family members).
 */
export const PERSON_LABELS: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  { get: (_, key: string) => key },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function stagesForHousingType(housingType: HousingType | ''): readonly string[] {
  if (housingType === 'HDB BTO') return BTO_STAGES;
  if (housingType === '') return BTO_STAGES; // default
  return RESALE_STAGES;
}

export function createEmptyCheckin(monthYear: string, familyId: string): MonthlyCheckin {
  return {
    familyId,
    monthYear,
    cpf: {},
    ledger: {
      income: {},
      fixedExpenses: [
        { label: 'Rent / mortgage', amount: 0 },
        { label: 'Utilities', amount: 0 },
        { label: 'Insurance premiums', amount: 0 },
        { label: 'Transport', amount: 0 },
      ],
      discretionary: [],
      notes: '',
    },
    investments: [],
    insurance: [],
    notes: '',
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeCheckin(
  raw: Partial<MonthlyCheckin> & { monthYear: string; familyId: string },
): MonthlyCheckin {
  const base = createEmptyCheckin(raw.monthYear, raw.familyId);
  return {
    ...base,
    ...raw,
    familyId: raw.familyId,
    cpf: { ...base.cpf, ...raw.cpf },
    ledger: {
      ...base.ledger,
      ...raw.ledger,
      income: { ...base.ledger.income, ...raw.ledger?.income },
      fixedExpenses: raw.ledger?.fixedExpenses ?? base.ledger.fixedExpenses,
      discretionary: (raw.ledger?.discretionary ?? base.ledger.discretionary).map((item) => ({
        ...item,
      })),
    },
    investments: (raw.investments ?? []).map((inv) => ({
      ...inv,
      ticker: inv.ticker ?? '',
      qty: inv.qty ?? 0,
      entryPrice: inv.entryPrice ?? 0,
      entryDate: inv.entryDate ?? '',
      currentPrice: inv.currentPrice ?? 0,
      currentPriceUpdatedAt: inv.currentPriceUpdatedAt ?? '',
      type: (INVESTMENT_TYPES as readonly string[]).includes(inv.type as string)
        ? inv.type as InvestmentType
        : 'Other',
    })),
    insurance: raw.insurance ?? [],
  };
}
