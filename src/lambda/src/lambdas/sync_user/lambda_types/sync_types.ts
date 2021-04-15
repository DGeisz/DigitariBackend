import { FollowTargetActivity } from "../../../global_types/FollowEntityType";
import { UserType } from "../../../global_types/UserTypes";
import { CommunityType } from "../../../global_types/CommunityTypes";

export interface SyncUserTarget {
    entity: FollowTargetActivity;
    user?: UserType;
}

export interface SyncCommunityTarget {
    entity: FollowTargetActivity;
    community?: CommunityType;
}
