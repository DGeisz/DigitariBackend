import { ExpoPushMessage, ExpoPushToken } from "expo-server-sdk";

export enum PushNotificationType {
    Message,
    NewConvo,
    ConvoDismissed,
    ConvoBlocked,
    ConvoFinished,
    UserFollowed,
}

export interface PushNotification extends ExpoPushMessage {
    to: ExpoPushToken;
    data: {
        type: PushNotificationType;
        content: string;
    };
    title: string;
    body: string;
    sound: "default";
}

export interface UserToken {
    uid: string;
    token: string;
    backOffTime: number;
    backOffInterval: number;
}

export interface PushTicket {
    id: string;
    time: number;
    ttl: number;
    ticket: string;
}
