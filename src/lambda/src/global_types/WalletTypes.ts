import { walletEntryExample, WalletEntryType } from "./WalletEntryTypes";

export interface WalletType {
    id: string;
    sum: number;
    expirationTime: number;
    entries: WalletEntryType[];
}
