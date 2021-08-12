export const AFTER_TAX_FRACTION = 0.9;

export function applyCoinTax(original: number): number {
    return Math.floor(AFTER_TAX_FRACTION * original);
}

export enum TransactionTypesEnum {
    User,
    Convo,
    LevelUp,
    Post,
    Community,
}

export enum TransactionIcon {
    Like,
    Convo,
    User,
    Feed,
    LevelUp,
    Community,
    Post,
}

export interface TransactionType {
    tid: string;
    time: number;
    coin: number;
    message: string;
    transactionType: TransactionTypesEnum;
    transactionIcon: TransactionIcon;
    data: string;
    ttl: number;
}

export interface BoltTransactionType {
    tid: string;
    time: number;
    bolts: number;
    message: string;
    transactionType: TransactionTypesEnum;
    transactionIcon: TransactionIcon;
    data: string;
    ttl: number;
}

export const TRANSACTION_TTL = 7 * 24 * 60 * 60;

export interface EarningsReceipt {
    coin: number;
    time: number;
}
