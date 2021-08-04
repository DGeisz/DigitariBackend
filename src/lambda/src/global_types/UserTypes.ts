export const USER_TYPENAME = "User";

export const FOLLOW_USER_PRICE = 200;
export const DIGIBOLT_PRICE = 10;

export const CHANGE_BIO_PRICE = 50;
export const CHANGE_PROFILE_PIC_PRICE = 100;
export const CHANGE_LINK_PRICE = 200;

export interface UserType {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    remainingInvites: number;
    transTotal: number;

    amFollowing: boolean;

    bio: string;
    link: string;
    ranking: number;
    blocked: number;
    beenBlocked: number;
    coin: number;
    bolts: number;

    maxWallet: number;
    walletBonusEnd: number;

    nameFont: NameFonts;
    nameFontsPurchased: NameFonts[];
    nameColor: ProfileColors;
    nameColorsPurchased: ProfileColors[];
    bioFont: BioFonts;
    bioFontsPurchased: BioFonts[];
    bioColor: ProfileColors;
    bioColorsPurchased: ProfileColors[];
    profileSticker: ProfileStickers;
    profileStickersPurchased: ProfileStickers[];

    lastCollectionTime: number;

    newConvoUpdate: boolean;
    newTransactionUpdate: boolean;

    challengeReceipts: string[];

    coinSpent: number;

    // Challenge fields
    receivedFromConvos: number;
    rfcChallengeIndex: number;

    spentOnConvos: number;
    socChallengeIndex: number;

    successfulConvos: number;
    scChallengeIndex: number;

    postCount: number;
    pcChallengeIndex: number;

    followers: number;
    followersChallengeIndex: number;

    following: number;
    followingChallengeIndex: number;

    communityFollowersChallengeIndex: number;
    maxCommunityFollowers: number;
}

export interface ExtendedUserType extends UserType {
    hid: string;
    timeCreated?: number;
    lastCheckIn?: number;
    lastFeedTime: number;
    feedPendingCollection: boolean;
    lastPostsTime: number;
    postsPendingCollection: boolean;
    transTotal: number;
    pushBackoffThreshold?: number;
    pushBackoffTime?: number;
    pushBackoffCount?: number;
}

export enum NameFonts {
    Default,
}

export enum BioFonts {
    Default,
}

export enum ProfileColors {
    Default,
}

export enum ProfileStickers {
    Default,
}

const WALLET_MULTIPLIER = 1.6;
const WALLET_BASE_SIZE = 100;
const WALLET_PRICE_MULTIPLIER = 1.84;
const WALLET_BASE_PRICE = 20;

/*
 * Calculate the price and size of the next wallet upgrade
 */
export function calculateWalletUpgrade(maxWallet: number): [number, number] {
    const currentExp = Math.ceil(
        Math.log(maxWallet / WALLET_BASE_SIZE) / Math.log(1.6)
    );

    const nextPrice = makePrettyNumber(
        WALLET_BASE_PRICE * WALLET_PRICE_MULTIPLIER ** currentExp
    );

    const nextSize = makePrettyNumber(
        WALLET_BASE_SIZE * WALLET_MULTIPLIER ** (currentExp + 1)
    );

    return [nextPrice, nextSize];
}

/*
 * Takes a number and makes it pretty.  Only two
 * non-zero leading values, and if it's less than 100,
 * it's a multiple of 5
 */
function makePrettyNumber(input: number): number {
    if (input < 100) {
        return Math.floor((input * 2) / 10) * 5;
    } else {
        const exp = Math.floor(Math.log10(input)) - 1;
        const multiplier = 10 ** exp;

        return Math.floor(input / multiplier) * multiplier;
    }
}
