import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import { DigitariPrice } from "../../global_types/DigitariPricesTypes";
import { UserType } from "../../global_types/UserTypes";
import { EventArgs } from "./lambda_types/event_type";
import { calculateActivityGrouping } from "../../utils/activity_grouping_utils";
import { sumReduce } from "../create_post/utils";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { insertFollowUserRow } from "./rds_queries/queries";
import { Client } from "elasticsearch";
import { ranking2Tier } from "../../utils/tier_utils";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    host:
        "https://search-digitari-actxnhry5uq2ipu3r6skwxcvfe.us-east-2.es.amazonaws.com",
    connectionClass: require("http-aws-es"),
});

export async function handler(event: AppSyncResolverEvent<EventArgs>) {
    const time = Date.now();

    /*
     * Get the price of following another user
     */
    const followPrice = ((
        await dynamoClient
            .get({
                TableName: "DigitariPrices",
                Key: {
                    id: "Follow",
                },
            })
            .promise()
    ).Item as DigitariPrice).price;

    /*
     * Get the source user
     */
    const sid = (event.identity as AppSyncIdentityCognito).sub;
    const sourcePostsRequested = 10;

    const source: UserType = (
        await dynamoClient
            .get({
                TableName: "DigitariUsers",
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
    const tid = event.arguments.tid;

    const target: UserType = (
        await dynamoClient
            .get({
                TableName: "DigitariUsers",
                Key: {
                    id: tid,
                },
            })
            .promise()
    ).Item as UserType;

    /*
     * Calculate the source's activity grouping
     * for target
     */
    let targetMean;

    if (target.followers > 0) {
        targetMean =
            sumReduce(target.postsRequestedForActivityGroupings) /
            target.followers;
    } else {
        targetMean = 0;
    }

    const activityGrouping = calculateActivityGrouping(
        sourcePostsRequested,
        targetMean,
        target.stdPostsDesired
    );

    /*
     * Create follower row in rds follows table
     */
    try {
        await rdsClient.executeQuery<boolean>(
            insertFollowUserRow(
                tid,
                sid,
                `${target.firstName} ${target.lastName}`,
                `${source.firstName} ${source.lastName}`,
                time,
                activityGrouping,
                ranking2Tier(source.ranking),
                sourcePostsRequested
            )
        );
    } catch (e) {
        throw new Error("RDS error: " + e);
    }

    /*
     * Increment target followers, and increase target's
     * ag size for source's ag.  Also increment the posts
     * requested for activity grouping
     */
    const agSize = "activityGroupingSize";
    const postsReq4Ag = "postsRequestedForActivityGroupings";

    try {
        await dynamoClient
            .update({
                TableName: "DigitariUsers",
                Key: {
                    id: tid,
                },
                UpdateExpression: `set followers = followers + :unit, 
                                   ${agSize}[${activityGrouping}] = ${agSize}[${activityGrouping}] + :unit,
                                   ${postsReq4Ag}[${activityGrouping}] = ${postsReq4Ag}[${activityGrouping}] + :posts
                                   `,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":posts": sourcePostsRequested,
                },
            })
            .promise();
    } catch (e) {
        throw new Error("Target update error: " + e);
    }
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
     * Increment the source's following field, and decrease the
     * users coin
     */
    try {
        await dynamoClient.update({
            TableName: "DigitariUsers",
            Key: {
                id: sid,
            },
            ConditionExpression: "coin >= :price",
            UpdateExpression: `set following = following + :unit,
                               coin = coin - :price`,
            ExpressionAttributeValues: {
                ":unit": 1,
                ":price": followPrice,
            },
        });
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
