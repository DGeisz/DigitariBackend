import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import {
    FOLLOW_USER_PRICE,
    FOLLOW_USER_REWARD,
    UserType,
} from "../../global_types/UserTypes";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import {
    followChecker,
    getUserPostRecords,
    insertFollowRow,
} from "./rds_queries/queries";
import { FollowEventArgs } from "../../global_types/follow_event_args";
import {
    DIGITARI_BOLT_TRANSACTIONS,
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { PushNotificationType } from "../../global_types/PushTypes";
import {
    BoltTransactionType,
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { FeedRecordType } from "../../global_types/FeedRecordTypes";
import { MAX_BATCH_WRITE_ITEMS } from "../../global_constants/aws_constants";
import { backoffPush } from "../../push_notifications/back_off_push";
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

    if (!source) {
        throw new Error("Source doesn't exist");
    }

    if (source.coin < FOLLOW_USER_PRICE) {
        throw new Error("Source doesn't have sufficient coin to follow target");
    }

    if (source.following >= source.maxFollowing) {
        throw new Error(
            "Source needs to level up in order to follow more people!"
        );
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

    if (!target) {
        throw new Error("Target doesn't exist");
    }

    if (target.followers >= target.maxFollowers) {
        /*
         * Do the peer pressure notification
         */
        await backoffPush(
            tid,
            PushNotificationType.UserFollowed,
            sid,
            "",
            `${source.firstName} tried to follow you, but you need to level up!`,
            dynamoClient
        );

        /*
         * Return null, indicating the follow didn't work
         */
        return null;
    }

    const updatePromises: Promise<any>[] = [];
    const finalPromises: Promise<any>[] = [];

    /*
     * Increment the target's search follows in elasticsearch
     * index
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
                    source: `ctx._source.followers = ${target.followers + 1}`,
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
                `${target.firstName} ${target.lastName}`,
                `${source.firstName} ${source.lastName}`,
                time,
                0
            )
        )
    );

    /*
     * Update target, add transaction coin and
     * signal new transaction update
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: tid,
                },
                UpdateExpression: `set followers = followers + :unit,
                                       transTotal = transTotal + :price,
                                       newTransactionUpdate = :b`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":price": FOLLOW_USER_PRICE,
                    ":b": true,
                },
            })
            .promise()
    );

    target.followers += 1;
    target.newTransactionUpdate = true;

    /*
     * Increment the source's following field, and decrease the
     * users coin
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: sid,
                },
                UpdateExpression: `set following = following + :unit,
                                       levelUsersFollowed = levelUsersFollowed + :unit,
                                       boltTransTotal = boltTransTotal + :reward,
                                       coin = coin - :price,
                                       coinSpent = coinSpent + :price`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":price": FOLLOW_USER_PRICE,
                    ":reward": FOLLOW_USER_REWARD,
                },
            })
            .promise()
    );

    source.following += 1;
    source.coin -= FOLLOW_USER_PRICE;
    source.coinSpent += FOLLOW_USER_PRICE;

    const pushMessage = `${source.firstName} followed you!`;

    /*
     * Create bolt transaction for source
     */
    const boltTransaction: BoltTransactionType = {
        tid: sid,
        time,
        bolts: FOLLOW_USER_REWARD,
        message: `You followed ${target.firstName}`,
        transactionType: TransactionTypesEnum.User,
        transactionIcon: TransactionIcon.User,
        data: tid,
        ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
    };

    /*
     * Send off bolt transaction
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_BOLT_TRANSACTIONS,
                Item: boltTransaction,
            })
            .promise()
    );

    /*
     * Create transaction for this target
     */
    const transaction: TransactionType = {
        tid,
        time,
        coin: FOLLOW_USER_PRICE,
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
     * Now we're going to try to auto-populate the user's feed
     * with the last up to 200 posts from the target
     */
    const postRecords = await rdsClient.executeQuery(getUserPostRecords(tid));

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
            tid,
            PushNotificationType.UserFollowed,
            sid,
            "",
            pushMessage,
            dynamoClient
        )
    );

    /*
     * Resolve everything
     */
    const finalResolution = await Promise.allSettled(finalPromises);

    if (finalResolution[0].status === "rejected") {
        throw new Error(finalResolution[0].reason);
        // throw new Error("Whelp, something broke. ¯\\_(ツ)_/¯");
    }

    return {
        tid,
        sid,
        time,
        name: `${source.firstName} ${source.lastName}`,
        entityType: 0,
    };
}
