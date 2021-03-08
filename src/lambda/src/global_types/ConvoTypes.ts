import { ConvoCoverType } from "./ConvoCoverTypes";
import {
    exampleStrippedPost,
    gExampleStrippedPost,
    gPostExampleWithLink,
    GStrippedPostType,
    PostType,
    StrippedPostType,
} from "./PostTypes";
import { ConvoMsgType } from "./ConvoMsgTypes";

export const CONVO_TYPENAME = "Convo";

export interface ConvoType {
    id: string;
    cover: ConvoCoverType;
    post: StrippedPostType;
    messages: ConvoMsgType[];
    status: number;
}
