import type { StoredMoney } from '@/lib/money';

/** Persisted Melt Party money is always an integer minor-unit value. */
export type Money = StoredMoney;
