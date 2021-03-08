export interface WalletEntryType {
    time: number;
    content: string;
    coin: number;
    entryType: 0 | 1 | 2; // Used to identify what to do with the entry
    meta: string; // Anything needed to take touch action on wallet entry
}

export interface GWalletEntryType extends WalletEntryType {
    __typename: string;
}

export const walletEntryExample: WalletEntryType = {
    time: 1612477300748,
    content: 'Grokeshien donated to your post "Treat yo self"',
    coin: 1200000,
    entryType: 0,
    meta: "gronk",
};

export const gWalletEntryExample: GWalletEntryType = Object.assign(
    {},
    walletEntryExample,
    { __typename: "WalletEntry" }
);
