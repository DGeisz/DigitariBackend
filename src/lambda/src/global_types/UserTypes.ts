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

    // Fields pertaining to post distribution
    postPrice: number;
    meanPostsDesired: number;
    stdPostsDesired: number;
    postsDesiredForActivityGrouping: number[];
    activityGroupingSize: number[];

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

export interface GUserType extends UserType {
    __typename: string;
}

export const exampleUser: UserType = {
    activityGroupingSize: [],
    meanPostsDesired: 0,
    postPrice: 0,
    postsDesiredForActivityGrouping: [],
    stdPostsDesired: 0,

    id: "danny",
    firstName: "Danny",
    lastName: "Geisz",
    userName: "derncern",
    level: 12,
    bio:
        "Hi my name is Danny. I bool, I vape, I joust, and I cape.  Here's to another day ba-rangling",

    amFollowing: false,
    followPrice: 50,

    ranking: 124,
    blocked: 12,
    beenBlocked: 435,
    coin: 1333,

    coinSpent: 1300,
    csGoal: 2000,
    nextCsIndex: 13,

    postCount: 12,
    pcGoal: 20,
    nextPcIndex: 15,

    donated2Other: 501,
    d2OGoal: 1000,
    nextD2OIndex: 20,

    donated2User: 230,
    d2UGoal: 300,
    nextD2UIndex: 45,

    responses2Other: 27,
    r2OGoal: 50,
    nextR2OIndex: 45,

    responses2User: 67,
    r2UGoal: 100,
    nextR2UIndex: 34,

    successfulConvos: 604,
    scGoal: 1000,
    nextScIndex: 56,

    following: 102,
    fgGoal: 200,
    nextFgIndex: 58,

    followers: 457,
    fsGoal: 500,
    nextFsIndex: 78,

    followersViaLink: 98,
    fvlGoal: 100,
    nextFvlIndex: 90,

    comsCreated: 12,
    ccGoal: 15,
    nextCcIndex: 28,

    welcomeCount: 35,
    wcGoal: 50,
    nextWcIndex: 58,

    invite2ComViaLink: 28,
    i2cGoal: 50,
    nextI2CIndex: 40,
};

export const gExampleUser: GUserType = Object.assign({}, exampleUser, {
    __typename: "User",
});
