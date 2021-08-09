import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { Client } from "elasticsearch";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { FollowEventArgs } from "../../global_types/follow_event_args";
import {
    followChecker,
    insertFollowRow,
} from "../follow_user/rds_queries/queries";
import { UserType } from "../../global_types/UserTypes";
import {
    CommunityType,
    FOLLOW_COMMUNITY_PRICE, FOLLOW_COMMUNITY_REWARD
} from "../../global_types/CommunityTypes";
import {
    DIGITARI_COMMUNITIES,
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import {
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { PushNotificationType } from "../../global_types/PushTypes";
import { getCommPostRecords } from "./rds_queries/queries";
import { FeedRecordType } from "../../global_types/FeedRecordTypes";
import { MAX_BATCH_WRITE_ITEMS } from "../../global_constants/aws_constants";
import { backoffPush } from "../../push_notifications/back_off_push";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    host: process.env.ES_DOMAIN,
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

    if (source.coin < FOLLOW_COMMUNITY_PRICE) {
        throw new Error("Source doesn't have sufficient coin to follow target");
    }

    if (source.following >= source.maxFollowing) {
        throw new Error(
            "Source needs to level up before they can follow more communities!"
        );
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

    const updatePromises: Promise<any>[] = [];
    const finalPromises: Promise<any>[] = [];

    /*
     * Increment the target's search follows in elasticsearch
     * index
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
                    source: "ctx._source.followers += 1",
                    lang: "painless",
                },
            },
        })
    );

    /*
     * Create follower row in rds follows table
     */
    updatePromises.push(
        rdsClient.executeQuery<boolean>(
            insertFollowRow(
                tid,
                sid,
                target.name,
                `${source.firstName} ${source.lastName}`,
                time,
                1
            )
        )
    );

    /*
     * Update the target
     */
    updatePromises.push(
        dynamoClient
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
            .promise()
    );

    target.followers += 1;

    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: sid,
                },
                UpdateExpression: `set following = following + :unit,
                                       levelsCommsFollowed = levelsCommsFollowed + :unit,
                                       bolts = bolts + :reward,
                                       coin = coin - :price,
                                       coinSpent = coinSpent + :price`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":price": FOLLOW_COMMUNITY_PRICE,
                    ":reward" : FOLLOW_COMMUNITY_REWARD
                },
            })
            .promise()
    );

    const pushMessage = `${source.firstName} followed your community: "${target.name}"`;

    /*
     * Flag the target's newTransactionUpdate as true
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: target.uid,
                },
                UpdateExpression: `set newTransactionUpdate = :b,
                                   transTotal = transTotal + :price`,
                ExpressionAttributeValues: {
                    ":b": true,
                    ":price": FOLLOW_COMMUNITY_PRICE,
                },
            })
            .promise()
    );

    /*
     * Create transaction for this bad boi
     */
    const transaction: TransactionType = {
        tid: target.uid,
        time,
        coin: FOLLOW_COMMUNITY_PRICE,
        message: pushMessage,
        transactionType: TransactionTypesEnum.User,
        transactionIcon: TransactionIcon.User,
        data: source.id,
        ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
    };

    /*
     * Send off the transaction
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_TRANSACTIONS,
                Item: transaction,
            })
            .promise()
    );

    finalPromises.push(Promise.all(updatePromises));

    /*
     * Now auto-populate user's feed with last up to 200 posts
     * from the target
     */
    const postRecords = await rdsClient.executeQuery(getCommPostRecords(tid));

    for (let i = 0; i < postRecords.length; i += MAX_BATCH_WRITE_ITEMS) {
        const writeRequests = [];

        for (let k = 0; k < MAX_BATCH_WRITE_ITEMS; ++k) {
            if (k + i >= postRecords.length) {
                break;
            } else {
                const { time, pid } = postRecords[i + k];

                const feedRecord: FeedRecordType = {
                    uid: sid,
                    time,
                    pid,
                };

                writeRequests.push({
                    PutRequest: {
                        Item: feedRecord,
                    },
                });
            }
        }

        finalPromises.push(
            dynamoClient
                .batchWrite({
                    RequestItems: {
                        DigitariFeedRecords: writeRequests,
                    },
                })
                .promise()
        );
    }

    finalPromises.push(
        backoffPush(
            target.uid,
            PushNotificationType.UserFollowedCommunity,
            sid,
            "",
            pushMessage,
            dynamoClient
        )
    );

    const finalResolution = await Promise.allSettled(finalPromises);

    if (finalResolution[0].status === "rejected") {
        throw new Error(finalResolution[0].reason);
        // throw new Error(
        //     "Well, that didn't work, and I guess it's our fault. What are you going to do about it?"
        // );
    }

    return {
        tid,
        sid,
        tuid: target.uid,
        time,
        name: `${source.firstName} ${source.lastName}`,
        entityType: 1,
    };
}
