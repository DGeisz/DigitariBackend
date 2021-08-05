import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { POST_BLOCK_COST, PostType } from "../../global_types/PostTypes";
import { ExtendedUserType } from "../../global_types/UserTypes";
import {
    DIGITARI_FEED_RECORDS,
    DIGITARI_POSTS,
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { EventArgs } from "./lambda_types/event_args";
import {
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<PostType> {
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const { pid } = event.arguments;

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
     * Make sure the user has enough digicoin to block the post
     */
    if (user.coin < POST_BLOCK_COST) {
        throw new Error("User doesn't have enough coin to block this post!");
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

    if (!post) {
        throw new Error("Post doesn't exist");
    }

    const updatePromises: Promise<any>[] = [];
    const finalPromises: Promise<any>[] = [];

    /*
     * First delete the post record to remove from the user's feed
     */
    updatePromises.push(
        dynamoClient
            .delete({
                TableName: DIGITARI_FEED_RECORDS,
                Key: {
                    uid,
                    time: post.time,
                },
            })
            .promise()
    );

    /*
     * Now update the original user
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set coin = coin - :amount,
                                   blocked = blocked + :unit,
                                   ranking = ranking - :unit`,
                ExpressionAttributeValues: {
                    ":amount": POST_BLOCK_COST,
                    ":unit": 1,
                },
            })
            .promise()
    );

    /*
     * Update the target user
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: post.uid,
                },
                UpdateExpression: `set beenBlocked = beenBlocked + :unit,
                                   ranking = ranking - :unit`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise()
    );

    const time = Date.now();

    /*
     * Create transaction for this bad boi
     */
    const transaction: TransactionType = {
        tid: post.uid,
        time,
        coin: 0,
        message: `${user.firstName} blocked your post: "${post.content}"`,
        transactionType: TransactionTypesEnum.User,
        transactionIcon: TransactionIcon.User,
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

    finalPromises.push(Promise.all(updatePromises));

    /*
     * Send push notifications to the target
     */
    finalPromises.push(
        sendPushAndHandleReceipts(
            post.uid,
            PushNotificationType.PostBlocked,
            uid,
            "",
            `${user.firstName} blocked your post`,
            dynamoClient
        )
    );

    const finalResolution = await Promise.allSettled(finalPromises);

    if (finalResolution[0].status === "rejected") {
        throw new Error(finalResolution[0].reason);
        // throw new Error("Guess what! There was a server error! Yay!!");
    }

    /*
     * Finally, return the post
     */
    return post;
}
