import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { Client } from "elasticsearch";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { FollowEventArgs } from "../../global_types/follow_event_args";
import {
    followChecker,
    insertFollowRow,
} from "../follow_user/rds_queries/queries";
import { DigitariPrice } from "../../global_types/DigitariPricesTypes";
import { UserType } from "../../global_types/UserTypes";
import { CommunityType } from "../../global_types/CommunityTypes";
import {
    DIGITARI_COMMUNITIES,
    DIGITARI_PRICES,
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { ranking2Tier } from "../../global_types/TierTypes";
import {
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";
import { communityFollowersHandler } from "../../challenges/challenge_handlers/community_followers/community_follower";

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

    const sourceTier = ranking2Tier(source.ranking);

    if (source.coin < followPrice) {
        throw new Error("Source doesn't have sufficient coin to follow target");
    }

    /*
     * Get the target community
     */
    const target: CommunityType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_COMMUNITIES,
                Key: {
                    id: tid,
                },
            })
            .promise()
    ).Item as CommunityType;

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
                target.name,
                `${source.firstName} ${source.lastName}`,
                time,
                1
            )
        );
    } catch (e) {
        throw new Error("RDS error: " + e);
    }

    /*
     * Update the target
     */
    try {
        await dynamoClient
            .update({
                TableName: DIGITARI_COMMUNITIES,
                Key: {
                    id: tid,
                },
                UpdateExpression: "set followers = followers + :unit",
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise();
    } catch (e) {
        throw new Error("Target update error: " + e);
    }

    target.followers += 1;

    /*
     * TODO: Add community followers field to user
     */
    try {
        await dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: sid,
                },
                UpdateExpression: `set following = following + :unit,
                                       coin = coin - :price,
                                       coinSpent = coin + :price`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":price": followPrice,
                },
            })
            .promise();
    } catch (e) {
        throw new Error("Source update error: " + e);
    }

    const pushMessage = `${source.firstName} followed your community: "${target.name}"`;

    /*
     * Flag the target's newTransactionUpdate as true
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: target.uid,
            },
            UpdateExpression: `set newTransactionUpdate = :b`,
            ExpressionAttributeValues: {
                ":b": true,
            },
        })
        .promise();

    /*
     * Create transaction for this bad boi
     */
    const transaction: TransactionType = {
        tid: target.uid,
        time,
        coin: followPrice,
        message: pushMessage,
        transactionType: TransactionTypesEnum.User,
        data: source.id,
        ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
    };

    /*
     * Send off the transaction
     */
    await dynamoClient
        .put({
            TableName: DIGITARI_TRANSACTIONS,
            Item: transaction,
        })
        .promise();

    try {
        await sendPushAndHandleReceipts(
            target.uid,
            PushNotificationType.UserFollowedCommunity,
            sid,
            "",
            pushMessage,
            dynamoClient
        );
    } catch (e) {}

    /*
     * Handle challenge updates
     */
    try {
        await communityFollowersHandler(
            target.uid,
            target.followers,
            dynamoClient
        );
    } catch (e) {}

    return {
        tid,
        sid,
        tuid: target.uid,
        time,
        name: `${source.firstName} ${source.lastName}`,
        entityType: 1,
    };
}
