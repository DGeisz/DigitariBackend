import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { Client } from "elasticsearch";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { FollowEventArgs } from "../../global_types/follow_event_args";
import { FollowEntityActivity } from "../../global_types/FollowEntityType";
import { getFollowEntity } from "../unfollow_user/rds_queries/queries";
import {
    DIGITARI_COMMUNITIES,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    host:
        "https://search-digitari-actxnhry5uq2ipu3r6skwxcvfe.us-east-2.es.amazonaws.com",
    connectionClass: require("http-aws-es"),
});

export async function handler(event: AppSyncResolverEvent<FollowEventArgs>) {
    const tid = event.arguments.tid;
    const sid = (event.identity as AppSyncIdentityCognito).sub;

    /*
     * Get activity information from the follows row
     */
    const followRows = await rdsClient.executeQuery<FollowEntityActivity>(
        getFollowEntity(tid, sid)
    );

    if (followRows.length < 1) {
        throw new Error("Source can't unfollow target");
    }

    const followActivity = followRows[0];

    /*
     * Delete row from follows activity
     */
    await rdsClient.executeSql(
        `DELETE FROM follows WHERE tid='${tid}' AND sid='${sid}'`
    );

    /*
     * Reduce number of follows in elastic search index
     */
    try {
        await esClient.updateByQuery({
            index: "search",
            type: "search_entity",
            body: {
                query: {
                    match: {
                        id: tid,
                    },
                },
                script: {
                    source: "ctx._source.followers -= 1",
                    lang: "painless",
                },
            },
        });
    } catch (e) {
        throw new Error("ES Error: " + e);
    }

    /*
     * Decrease the source's following count
     */
    try {
        await dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: sid,
                },
                UpdateExpression: `set following = following - :unit`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise();
    } catch (e) {
        throw new Error("Source update error: " + e);
    }

    /*
     * Mess with the target
     */
    const postReq = "postsRequestedForActivityGroupingsByTier";
    const agSize = "activityGroupingSizeByTier";

    try {
        await dynamoClient
            .update({
                TableName: DIGITARI_COMMUNITIES,
                Key: {
                    id: tid,
                },
                UpdateExpression: `set followers = followers - :unit, 
                                   ${agSize}[${followActivity.tier}][${followActivity.activityGroup}] = ${agSize}[${followActivity.tier}][${followActivity.activityGroup}] - :unit,
                                   ${postReq}[${followActivity.tier}][${followActivity.activityGroup}] = ${postReq}[${followActivity.tier}][${followActivity.activityGroup}] - :posts`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":posts": followActivity.postsRequested,
                },
            })
            .promise();
    } catch (e) {
        throw new Error("Target update error: " + e);
    }

    return {
        tid,
        sid,
        time: Date.now(),
        name: "",
        entityType: 0,
    };
}
