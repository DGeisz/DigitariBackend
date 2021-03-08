import { ConvoCoverType, exampleConvoCover } from "./ConvoCoverTypes";

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
    coinDonated?: boolean;
    convos: ConvoCoverType[];
}

export interface GPostType extends PostType {
    __typename: string;
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

export interface GStrippedPostType extends StrippedPostType {
    __typename: string;
}

export const postExampleNoLink: PostType = {
    id: "asd",
    uid: "danny",
    coin: 40000,
    content: `Hi my name is Jeff and I'm an antelope. Why, you ask, do I mention that? It is my cornerstone, and I'm in love with that fact about myself.`,
    convoReward: 200,
    ranking: 142,
    responseCost: 4,
    time: 1612394591366,
    user: "Danny",
    coinDonated: false,
    // convo: []
    convos: [exampleConvoCover, exampleConvoCover],
};

export const exampleStrippedPost: StrippedPostType = {
    id: "asd",
    uid: "danny",
    content: `Hi my name is Jeff and I'm an antelope. Why, you ask, do I mention that? It is my cornerstone, and I'm in love with that fact about myself.`,
    ranking: 142,
    time: 1612394591366,
    user: "Danny",
    link: "https://expo.io/",
    convoReward: 200,
};

export const gExampleStrippedPost = Object.assign({}, exampleStrippedPost, {
    __typename: "Post",
});

export const postExampleWithLink: PostType = {
    link: "https://expo.io/",
    id: "asd",
    uid: "danny",
    coin: 40000,
    content: `Hi my name is Jeff and I'm an antelope. Why, you ask, do I mention that? It is my cornerstone, and I'm in love with that fact about myself.`,
    convoReward: 200,
    ranking: 142,
    responseCost: 4,
    time: 1612394591366,
    user: "Danny",
    coinDonated: false,
    // convos: [],
    convos: [exampleConvoCover, exampleConvoCover],
};

export const gPostExampleWithLink: GPostType = Object.assign(
    {},
    postExampleWithLink,
    { __typename: "Post" }
);
