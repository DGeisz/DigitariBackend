import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { Client } from "elasticsearch";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { FollowEventArgs } from "../../global_types/follow_event_args";
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
    host: process.env.ES_DOMAIN,
    connectionClass: require("http-aws-es"),
});

export async function handler(event: AppSyncResolverEvent<FollowEventArgs>) {
    const tid = event.arguments.tid;
    const sid = (event.identity as AppSyncIdentityCognito).sub;

    /*
     * Get activity information from the follows row
     */
    const followRows = await rdsClient.executeQuery(getFollowEntity(tid, sid));

    if (followRows.length < 1) {
        throw new Error("Source can't unfollow target");
    }

    const updatePromises: Promise<any>[] = [];

    /*
     * Delete row from follows activity
     */
    updatePromises.push(
        rdsClient.executeSql(
            `DELETE FROM follows WHERE tid='${tid}' AND sid='${sid}'`
        )
    );

    /*
     * Reduce number of follows in elastic search index
     */
    updatePromises.push(
        esClient.updateByQuery({
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
        })
    );

    /*
     * Decrease the source's following count
     */
    updatePromises.push(
        dynamoClient
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
            .promise()
    );

    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_COMMUNITIES,
                Key: {
                    id: tid,
                },
                UpdateExpression: "set followers = followers - :unit",
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise()
    );

    await Promise.all(updatePromises);

    return {
        tid,
        sid,
        time: Date.now(),
        name: "",
        entityType: 1,
    };
}
