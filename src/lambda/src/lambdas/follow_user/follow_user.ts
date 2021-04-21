import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import { DigitariPrice } from "../../global_types/DigitariPricesTypes";
import { UserType } from "../../global_types/UserTypes";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { followChecker, insertFollowRow } from "./rds_queries/queries";
import { Client } from "elasticsearch";
import { FollowEventArgs } from "../../global_types/follow_event_args";
import {
    DIGITARI_PRICES,
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
    const time = Date.now();

    const sid = (event.identity as AppSyncIdentityCognito).sub;
    const tid = event.arguments.tid;

    /*
     * Check if there's already a follow entity for this pair of
     * tid and sid
     */
    const followRows = await rdsClient.executeQuery(followChecker(tid, sid));

    if (followRows.length !== 0) {
        throw new Error("Source already following target!");
    }

    /*
     * Get the price of following another user
     */
    const followPrice = ((
        await dynamoClient
            .get({
                TableName: DIGITARI_PRICES,
                Key: {
                    id: "Follow",
                },
            })
            .promise()
    ).Item as DigitariPrice).price;

    /*
     * Get the source user
     */
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

    if (source.coin < followPrice) {
        throw new Error("Source doesn't have sufficient coin to follow target");
    }

    /*
     * Get the target user
     */
    const target: UserType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: tid,
                },
            })
            .promise()
    ).Item as UserType;

    // /*
    //  * Calculate the source's activity grouping
    //  * for target
    //  */
    // let targetMean;
    //
    // if (target.followers > 0) {
    //     targetMean =
    //         sumReduce(target.postsRequestedForActivityGroupings) /
    //         target.followers;
    // } else {
    //     targetMean = 0;
    // }
    //
    // const activityGrouping = calculateActivityGrouping(
    //     sourcePostsRequested,
    //     targetMean,
    //     target.stdPostsDesired
    // );

    /*
     * Increment the target's search follows in elasticsearch
     * index
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
                    source: "ctx._source.followers += 1",
                    lang: "painless",
                },
            },
        });
    } catch (e) {
        throw new Error("ES Error: " + e);
    }

    /*
     * Create follower row in rds follows table
     */
    try {
        await rdsClient.executeQuery<boolean>(
            insertFollowRow(
                tid,
                sid,
                `${target.firstName} ${target.lastName}`,
                `${source.firstName} ${source.lastName}`,
                time,
                0
            )
        );
    } catch (e) {
        throw new Error("RDS error: " + e);
    }

    try {
        await dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: tid,
                },
                UpdateExpression: `set followers = followers + :unit`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise();
    } catch (e) {
        throw new Error("Target update error: " + e);
    }

    /*
     * Increment the source's following field, and decrease the
     * users coin
     */
    try {
        await dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: sid,
                },
                UpdateExpression: `set following = following + :unit,
                                       coin = coin + :price`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":price": -1 * followPrice,
                },
            })
            .promise();
    } catch (e) {
        throw new Error("Source update error: " + e);
    }

    return {
        tid,
        sid,
        time,
        name: `${source.firstName} ${source.lastName}`,
        entityType: 0,
    };
}
