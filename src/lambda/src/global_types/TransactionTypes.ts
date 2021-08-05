export enum TransactionTypesEnum {
    User,
    Convo,
    Challenge,
    Post,
}

export enum TransactionIcon {
    Bolt,
    Convo,
    User,
    Feed,
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

export const TRANSACTION_TTL = 7 * 24 * 60 * 60;

export interface EarningsReceipt {
    coin: number;
    time: number;
}
