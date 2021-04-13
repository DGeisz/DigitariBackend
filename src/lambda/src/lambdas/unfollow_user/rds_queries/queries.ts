import { QueryPackage } from "../../../data_clients/rds_client/rds_client";
import { FollowEntityActivity } from "../../../global_types/FollowEntityType";
import { FieldList } from "aws-sdk/clients/rdsdataservice";

function followEntityParser(row: FieldList): FollowEntityActivity {
    return {
        entityType: row[0].longValue,
        activityGroup: row[1].longValue,
        tier: row[2].longValue,
        postsRequested: row[3].doubleValue,
    };
}

export function getFollowEntity(
    tid: string,
    sid: string
): QueryPackage<FollowEntityActivity> {
    return {
        sql: `SELECT entity_type, activity_group, tier, posts_requested FROM follows WHERE tid='${tid}' AND sid='${sid}';`,
        resultParser: followEntityParser,
    };
}
