export const POST_CONTENT_MAX_LEN = 250;
export const POST_ADD_ON_CONTENT_MAX_LEN = 10000;

export enum PostAddOn {
    None,
    Text,
    Image,
    Link,
}

export enum PostTarget {
    MyFollowers,
    Community,
}

export interface PostType {
    id: string;
    uid: string;

    user: string;
    tier: number;
    time: string;
    content: string;

    addOn: PostAddOn;
    addOnContent: string;
    target: PostTarget;
    cmid?: string;
    communityName?: string;

    convoReward: number;
    responseCost: number;

    coin: number;
    coinDonated?: boolean;

    convoCount: number;
    responseCount: number;
}

export interface StrippedPostType {
    id: string;
    uid: string;
    user: string;
    ranking: number;
    time: number;
    content: string;
    link?: string;
    convoReward: number;
}

export interface DonationRecord {
    uid: string;
    pid: string;
    tuid: string;
    amount: number;
    name: string;
}
