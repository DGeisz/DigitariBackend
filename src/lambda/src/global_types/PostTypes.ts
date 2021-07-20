import { NameFonts, ProfileColors, ProfileStickers } from "./UserTypes";

export const POST_CONTENT_MAX_LEN = 250;
export const POST_ADD_ON_CONTENT_MAX_LEN = 10000;
export const POST_BLOCK_COST = 200;

export const BOLT_HASH_SEED = "Digibolts";

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
    boltsBought?: number;

    addOn: PostAddOn;
    addOnContent: string;
    target: PostTarget;
    cmid?: string;
    communityName?: string;

    responseCost: number;

    coin: number;

    convoCount: number;
    responseCount: number;

    nameColor: ProfileColors;
    nameFont: NameFonts;
    sticker: ProfileStickers;
}

export interface ExtendedPostType extends PostType {
    recipients: number;
    distributed: boolean;
}

export interface DonationRecord {
    uid: string;
    pid: string;
    tuid: string;
    amount: number;
    name: string;
}

/*
 * For use in auto-populate feed after following users
 * and communities
 */
export interface PostRecord {
    pid: string;
    time: number;
}
