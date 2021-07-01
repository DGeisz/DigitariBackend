export const USER_TYPENAME = "User";

export const FOLLOW_USER_PRICE = 200;
export const DIGIBOLT_PRICE = 10;

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
