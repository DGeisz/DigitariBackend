export const MESSAGE_MAX_LEN = 5000;

export interface MessageType {
    id: string;
    anonymous: boolean;
    content: string;
    time: string;
    uid: string;
    tid: string;
    user: string;
}
