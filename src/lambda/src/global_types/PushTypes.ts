import { ExpoPushMessage, ExpoPushToken } from "expo-server-sdk";

export enum PushNotificationType {
    Message,
    NewConvo,
    ConvoDismissed,
    ConvoBlocked,
    ConvoFinished,
    UserFollowed,
    UserFollowedCommunity,
    CoinDonated,
    ChallengeComplete,
    PostBlocked,
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
    /*
     * This is the id of the token to which this ticket corresponds
     */
    id: string;
    /*
     * This is the time the ticket was created
     */
    time: number;
    /*
     * This is a value dynamo uses to clear out old receipts
     */
    ttl: number;
    /*
     * This is the actual id of the ticket
     */
    ticket: string;
}
