export const USER_TYPENAME = "User";

export const FOLLOW_USER_PRICE = 200;
export const FOLLOW_USER_REWARD = 20;
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
    boltTransTotal: number;
    imgUrl?: string;

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

    maxBoltWallet: number;

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

    // Level fields
    level: number;
    levelUsersFollowed: number;
    levelsCommsFollowed: number;
    levelCoinCollected: number;
    levelPostsCreated: number;
    levelPostBoltsBought: number;
    levelInvitedAndJoined: number;
    levelNewResponses: number;
    levelSuccessfulConvos: number;
    levelCommsCreated: number;
    levelCoinSpentOnPosts: number;
    levelCoinEarnedFromPosts: number;

    challengeReceipts?: string[];

    coinSpent: number;

    maxFollowers: number;
    followers: number;

    maxFollowing: number;
    following: number;

    maxPostRecipients: number;

    postCount: number;
    spentOnConvos: number;
    receivedFromConvos: number;
    successfulConvos: number;

    // Challenge fields - DEPRECATED
    rfcChallengeIndex?: number;

    socChallengeIndex?: number;

    scChallengeIndex?: number;

    pcChallengeIndex?: number;

    followersChallengeIndex?: number;

    followingChallengeIndex?: number;

    communityFollowersChallengeIndex?: number;
    maxCommunityFollowers?: number;
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

const WALLET_PRICE_COEFF = 1;

/*
 * Calculate the price and size of the next wallet upgrade
 */
export function calculateWalletUpgrade(maxWallet: number): [number, number] {
    const nextPrice = makePrettyNumber(maxWallet * WALLET_PRICE_COEFF);
    const nextSize = makePrettyNumber(maxWallet * WALLET_MULTIPLIER);

    return [nextPrice, nextSize];
}

const BOLT_WALLET_PRICE_COEFF = 10;

/*
 * Calculate the price and size of next bolt wallet upgrade
 */
export function calculateBoltWalletUpgrade(
    maxBoltWallet: number
): [number, number] {
    const nextPrice = makePrettyNumber(maxBoltWallet * BOLT_WALLET_PRICE_COEFF);

    const nextSize = makePrettyNumber(maxBoltWallet * WALLET_MULTIPLIER);

    return [nextPrice, nextSize];
}

/*
 * Takes a number and makes it pretty.  Only two
 * non-zero leading values, and if it's less than 100,
 * it's a multiple of 5
 */
export function makePrettyNumber(input: number): number {
    if (input < 100) {
        return Math.floor((input * 2) / 10) * 5;
    } else {
        const exp = Math.floor(Math.log10(input)) - 1;
        const multiplier = 10 ** exp;

        return Math.floor(input / multiplier) * multiplier;
    }
}
