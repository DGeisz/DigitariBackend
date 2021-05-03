export enum TransactionTypesEnum {
    User,
    Convo,
    Challenge,
}

export interface TransactionType {
    tid: string;
    time: number;
    coin: number;
    message: string;
    transactionType: TransactionTypesEnum;
    data: string;
    ttl: number;
}

export interface EarningsReceipt {
    coin: number;
    time: number;
}
