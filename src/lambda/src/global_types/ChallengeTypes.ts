export interface ChallengeType {
    class: number;
    tier: number; // What level challenge is this
    index: number; // Essentially functions as a sortable id
    description: string;
    coinReward: number;
    goal: number; // Number necessary to achieve goal
}

export interface GChallengeType extends ChallengeType {
    __typename: string;
}

export const challengeClasses = {
    coinSpent: 0,
    postCount: 1,
    donated2Other: 2,
    donated2User: 3,
    responses2Other: 4,
    responses2User: 5,
    successfulConvos: 6,
    following: 7,
    followers: 8,
    followersViaLink: 9,
    comsCreated: 10,
    welcomeCount: 11,
    invite2ComViaLink: 12,
};

export const exampleChallenge: ChallengeType = {
    description: "Get 1,000 followers",
    // description: "This is really really really really really really really long description",
    index: 1,
    tier: 3,
    class: challengeClasses.followers,
    coinReward: 200,
    goal: 1000,
};

export const gExampleChallenge: GChallengeType = Object.assign(
    {},
    exampleChallenge,
    { __typename: "Challenge" }
);
