import { FieldList } from "aws-sdk/clients/rdsdataservice";
import { FollowTargetActivity } from "../../../global_types/FollowEntityType";
import { QueryPackage } from "../../../data_clients/rds_client/rds_client";

function followingParser(row: FieldList): FollowTargetActivity {
    return {
        tid: row[0].stringValue,
        entityType: row[1].longValue,
        activityGroup: row[2].longValue,
        tier: row[3].longValue,
        postsRequested: row[4].doubleValue,
    };
}

export function getFollowingWithActivity(
    sid: string
): QueryPackage<FollowTargetActivity> {
    return {
        sql: `SELECT tid, entity_type as entityType, activity_group as activityGroup, 
                     tier, posts_requested as postsRequested FROM follows WHERE sid=${sid};`,
        resultParser: followingParser,
    };
}
