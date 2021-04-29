export const CONVO_TYPENAME = "Convo";

export const TARGET_MESSAGE_COUNT_THRESHOLD = 2;

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

    tid: string;
    ttier: number;
    tranking: number;
    tname: string;
    tviewed: boolean;

    targetMsgCount: number;
    convoReward: number;
    responseCost: number;
}

export interface ExtendedConvoType extends ConvoType {
    suid: string;
}

export interface ConvoUpdate {
    tid: string;
    convo: ConvoType;
}
