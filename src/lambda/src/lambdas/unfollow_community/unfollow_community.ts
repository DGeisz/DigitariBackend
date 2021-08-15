import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { FollowEventArgs } from "../../global_types/follow_event_args";
import { getFollowEntity } from "../unfollow_user/rds_queries/queries";
import {
    DIGITARI_COMMUNITIES,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { UserType } from "../../global_types/UserTypes";
import { FOLLOW_COMMUNITY_REWARD } from "../../global_types/CommunityTypes";
import { Client } from "@elastic/elasticsearch";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    cloud: {
        id: process.env.ES_CLOUD_ID,
    },
    auth: {
        username: process.env.ES_CLOUD_USERNAME,
        password: process.env.ES_CLOUD_PASSWORD,
    },
});

export async function handler(event: AppSyncResolverEvent<FollowEventArgs>) {
    const tid = event.arguments.tid;
    const sid = (event.identity as AppSyncIdentityCognito).sub;

    const source: UserType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: sid,
                },
            })
            .promise()
    ).Item as UserType;

    if (source.bolts < FOLLOW_COMMUNITY_REWARD) {
        throw new Error(
            `You need ${FOLLOW_COMMUNITY_REWARD} bolts to unfollow a community!`
        );
    }

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
                UpdateExpression: `set following = following - :unit,
                                       bolts = bolts - :r`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":r": FOLLOW_COMMUNITY_REWARD,
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
