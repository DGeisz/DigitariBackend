import { makePrettyNumber } from "./UserTypes";

export const CONVO_TYPENAME = "Convo";

export const MESSAGE_COUNT_THRESHOLD = 2;
export const CONVO_ACTIVATION_COST = 5;
export const CONVO_REWARD_MULTIPLIER = 0.15;

export interface ConvoType {
    id: string;
    pid: string;
    cmid: string;

    status: number;

    initialTime: string;
    initialMsg: string;

    lastTime: string;
    lastMsg: string;

    sid: string;
    stier: number;
    sranking: number;
    sname: string;
    sanony: boolean;
    sviewed: boolean;
    sourceMsgCount: number;

    tid: string;
    ttier: number;
    tranking: number;
    tname: string;
    tviewed: boolean;
    targetMsgCount: number;

    responseCost: number;
}

export interface ExtendedConvoType extends ConvoType {
    suid: string;
}

export interface ConvoUpdate {
    tid: string;
    convo: ConvoType;
}

/**
 * Gets the amount that the blocker's ranking decreases
 * when blocking
 */
export function blockSourceDelta(ranking: number): number {
    return Math.max(Math.floor(ranking * 0.1), 2);
}

/**
 * Gets the amount that the target's ranking decreases
 * when getting blocked
 */
export function blockTargetDelta(ranking: number): number {
    return Math.max(Math.floor(ranking * 0.25), 4);
}

export function convoReward(responseCost: number): number {
    return makePrettyNumber(CONVO_REWARD_MULTIPLIER * responseCost);
}
