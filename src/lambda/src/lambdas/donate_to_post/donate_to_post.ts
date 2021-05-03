import { DynamoDB } from "aws-sdk";
import { DonationRecord, PostType } from "../../global_types/PostTypes";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "./lambda_types/event_args";
import { ExtendedUserType } from "../../global_types/UserTypes";
import {
    DIGITARI_DONATION_RECORDS,
    DIGITARI_POSTS,
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import {
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";
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
        throw new Error("A donation must have at least one coin");
    }

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
     * this donation
     */
    if (user.coin < amount) {
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
    const targetUser: ExtendedUserType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: post.uid,
                },
            })
            .promise()
    ).Item as ExtendedUserType;

    /*
     * Ok, now then we need to check whether
     * this user has already donated to this post
     */
    const record = await dynamoClient
        .get({
            TableName: DIGITARI_DONATION_RECORDS,
            Key: {
                uid,
                pid,
            },
        })
        .promise();

    /*
     * If the item wasn't null, then we throw an error indicating the post
     * has already been donated to by this user
     */
    if (!!record.Item) {
        throw new Error("This user has already donated to this post");
    }

    /*
     * Add coin to the actual post
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_POSTS,
            Key: {
                id: pid,
            },
            UpdateExpression: `set coin = coin + :amount`,
            ExpressionAttributeValues: {
                ":amount": amount,
            },
        })
        .promise();

    /*
     * Ok, now create a donation record...
     */
    await dynamoClient
        .put({
            TableName: DIGITARI_DONATION_RECORDS,
            Item: {
                uid,
                pid,
                tuid: targetUser.id,
                amount: amount,
                name: targetUser.firstName,
            },
        })
        .promise();

    /*
     * Now deduct the coin from the user
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: uid,
            },
            UpdateExpression: `set coin = coin - :amount`,
            ExpressionAttributeValues: {
                ":amount": amount,
            },
        })
        .promise();

    /*
     * Flag the poster's new transaction update
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: targetUser.id,
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
        tid: targetUser.id,
        time,
        coin: amount,
        message: `${user.firstName} liked your post: "${post.content}"`,
        transactionType: TransactionTypesEnum.User,
        data: uid,
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

    /*
     * Send push notifications to the target
     */
    try {
        await sendPushAndHandleReceipts(
            targetUser.id,
            PushNotificationType.CoinDonated,
            uid,
            `${user.firstName} liked your post`,
            "",
            dynamoClient
        );
    } catch (e) {}

    return {
        uid,
        pid,
        tuid: targetUser.id,
        amount: amount,
        name: targetUser.firstName,
    };
}
