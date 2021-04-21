import { PostAddOn, PostTarget } from "../../../global_types/PostTypes";

export interface EventArgs {
    content: string;
    addOn: PostAddOn;
    addOnContent: string;
    target: PostTarget;
    cmid?: string;

    recipients: number;
}
