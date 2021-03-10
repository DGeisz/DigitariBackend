import { ConvoCoverType } from "./ConvoCoverTypes";

export interface PostType {
    id: string;
    user: string;
    targetCommunity?: string;
    targetCommunityId?: string;
    uid: string;
    ranking: number;
    time: number;
    content: string;
    link?: string;
    convoReward: number;
    responseCost: number;
    coin: number;
    coinDonated?: boolean;
    convos: ConvoCoverType[];
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
