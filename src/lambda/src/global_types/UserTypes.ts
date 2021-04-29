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

    // Challenge fields
    coinSpent: number;
    csGoal: number;
    nextCsIndex: number;

    postCount: number;
    pcGoal: number;
    nextPcIndex: number;

    donated2Other: number;
    d2OGoal: number;
    nextD2OIndex: number;

    donated2User: number;
    d2UGoal: number;
    nextD2UIndex: number;

    responses2Other: number;
    r2OGoal: number;
    nextR2OIndex: number;

    responses2User: number;
    r2UGoal: number;
    nextR2UIndex: number;

    successfulConvos: number;
    scGoal: number;
    nextScIndex: number;

    following: number;
    fgGoal: number;
    nextFgIndex: number;

    followers: number;
    fsGoal: number;
    nextFsIndex: number;

    followersViaLink: number;
    fvlGoal: number;
    nextFvlIndex: number;

    comsCreated: number;
    ccGoal: number;
    nextCcIndex: number;

    welcomeCount: number;
    wcGoal: number;
    nextWcIndex: number;

    invite2ComViaLink: number;
    i2cGoal: number;
    nextI2CIndex: number;
}

export interface ExtendedUserType extends UserType {
    hid: string;
}
