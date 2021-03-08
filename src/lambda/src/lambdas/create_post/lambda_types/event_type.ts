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
