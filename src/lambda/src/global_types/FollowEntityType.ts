export interface FollowEntityType {
    sid: string;
    tid: string;
    name: string;
    time: string;
    entityType: number;
}

export interface FollowEntityActivity {
    entityType: number;
    activityGroup: number;
    tier: number;
    postsRequested: number;
}

export interface FollowTargetActivity {
    tid: string;
    entityType: number;
    activityGroup: number;
    tier: number;
    postsRequested: number;
}
