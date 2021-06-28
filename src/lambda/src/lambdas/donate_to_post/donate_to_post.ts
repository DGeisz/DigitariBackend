import { DynamoDB } from "aws-sdk";
import { DonationRecord, PostType } from "../../global_types/PostTypes";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "./lambda_types/event_args";
import { DIGIBOLT_PRICE, ExtendedUserType } from "../../global_types/UserTypes";
import {
    DIGITARI_POSTS,
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import {
    TRANSACTION_TTL,
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";
import { challengeCheck } from "../../challenges/challenge_check";
import { toRep } from "../../utils/value_rep_utils";

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<DonationRecord> {
    const time = Date.now();
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const { pid, amount } = event.arguments;

    /*
     * Make sure the amount is all good
     */
    if (amount === 0) {
        throw new Error("Must get at least one bolt");
    }

    const coinTotal = amount * DIGIBOLT_PRICE;

    /*
     * First, fetch the user in its full glory
     */
    const user: ExtendedUserType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
            })
            .promise()
    ).Item as ExtendedUserType;

    /*
     * Now check that the user has enough digicoin to make
     * this transaction
     */
    if (user.coin < coinTotal) {
        throw new Error("User doesn't have enough coin to donate this amount");
    }

    /*
     * Now fetch the post in question
     */
    const post: PostType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_POSTS,
                Key: {
                    id: pid,
                },
            })
            .promise()
    ).Item as PostType;

    /*
     * Make sure you aren't donating to your own post
     */
    if (post.uid === uid) {
        throw new Error("You can't donate to your own post");
    }

    /*
     * Now from the post, get the user that posted
     */
    const targetUser = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: post.uid,
                },
            })
            .promise()
    ).Item as ExtendedUserType | undefined;

    const updatePromises: Promise<any>[] = [];
    const finalPromises: Promise<any>[] = [];

    /*
     * Add coin to the actual post
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_POSTS,
                Key: {
                    id: pid,
                },
                UpdateExpression: `set coin = coin + :c`,
                ExpressionAttributeValues: {
                    ":c": coinTotal,
                },
            })
            .promise()
    );

    /*
     * Now deduct the coin from the user,
     * and give them their bolts
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set coin = coin - :c,
                                   bolts = bolts + :bolts,
                                   coinSpent = coinSpent + :c,
                                   spentOnConvos = spentOnConvos + :c`,
                ExpressionAttributeValues: {
                    ":c": coinTotal,
                    ":bolts": amount,
                },
            })
            .promise()
    );

    user.coin -= coinTotal;
    user.bolts += amount;
    user.coinSpent += coinTotal;
    user.spentOnConvos += coinTotal;

    /*
     * If the target user exists, then create a transaction, and update
     * the target user
     */
    if (!!targetUser) {
        /*
         * Flag the poster's new transaction update
         */
        updatePromises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_USERS,
                    Key: {
                        id: targetUser.id,
                    },
                    UpdateExpression: `set newTransactionUpdate = :b,
                                   transTotal = transTotal + :c,
                                   receivedFromConvos = receivedFromConvos + :c`,
                    ExpressionAttributeValues: {
                        ":b": true,
                        ":c": coinTotal,
                    },
                })
                .promise()
        );

        targetUser.newTransactionUpdate = true;
        targetUser.receivedFromConvos += coinTotal;

        /*
         * Create transaction for this bad boi
         */
        const transaction: TransactionType = {
            tid: targetUser.id,
            time,
            coin: coinTotal,
            message: `${user.firstName} spent ${toRep(
                coinTotal
            )} digicoin on your post: "${post.content}"`,
            transactionType: TransactionTypesEnum.User,
            data: uid,
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

        /*
         * Send push notifications to the target
         */
        finalPromises.push(
            sendPushAndHandleReceipts(
                targetUser.id,
                PushNotificationType.CoinDonated,
                uid,
                "",
                `${user.firstName} spent ${toRep(
                    coinTotal
                )} digicoin on your post`,
                dynamoClient
            )
        );

        finalPromises.push(challengeCheck(targetUser, dynamoClient));
    }

    /*
     * Handle challenge updates
     */
    finalPromises.push(challengeCheck(user, dynamoClient));

    const finalResolution = await Promise.allSettled([
        Promise.all(updatePromises),
        ...finalPromises,
    ]);

    if (finalResolution[0].status === "rejected") {
        throw new Error(finalResolution[0].reason);
        // throw new Error(
        //     "Server error. We're going to live forever or die trying"
        // );
    }

    return {
        uid,
        pid,
        tuid: !!targetUser ? targetUser.id : "",
        amount: amount,
        name: !!user ? user.firstName : "",
    };
}
