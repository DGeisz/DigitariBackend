export interface EventArgs {
    content: string;
    link?: string;
    convoReward: number;
    responseCost: number;

    post2Followers: boolean;
    numUserFollowers: number;

    post2Community: boolean;
    cmid: string;
    numComFollowers: number;
}

export interface PostType {
    id: string;
    user: string;
    uid: string;
    ranking: number;
    time: number;
    content: string;
    link?: string;
    convoReward: number;
    responseCost: number;
    coin: number;
    convos: ConvoCoverType[];
}

export interface ConvoCoverType {
    // Convo ids
    id: string;
    pid: string;

    // Static fields
    time: number;
    msg: string;

    // Source user fields
    sid: string;
    sranking: number;
    sname: string;
    sviewed: boolean;
    sanony: boolean;

    // Target user fields
    tid: string;
    tranking: number;
    tname: string;
    tviewed: boolean;
}

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
