export const USER_TYPENAME = "User";

export interface UserType {
    id: string;
    firstName: string;
    lastName: string;
    userName: string;

    newUser?: boolean;

    amFollowing: boolean;
    followPrice: number;

    level: number;
    bio: string;
    ranking: number;
    blocked: number;
    beenBlocked: number;
    coin: number;

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
}
