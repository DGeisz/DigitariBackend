import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "./lambda_types/event_args";
import { MESSAGE_MAX_LEN } from "../../global_types/MessageTypes";
import { ExtendedUserType, UserType } from "../../global_types/UserTypes";
import {
    DIGITARI_MESSAGES,
    DIGITARI_POSTS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { checkForConvo, createConvo } from "./rds_queries/queries";
import { PostType } from "../../global_types/PostTypes";
import { v4 } from "uuid";
import { ranking2Tier } from "../../global_types/TierTypes";
import { ConvoType } from "../../global_types/ConvoTypes";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<ConvoType> {
    const time = Date.now();
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const cvid = v4();

    const { pid, message, anonymous } = event.arguments;

    /*
     * First check arguments
     */
    if (message.length > MESSAGE_MAX_LEN) {
        throw new Error("Initial message is too long");
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

    const sid = anonymous ? user.hid : uid;
    const sname = anonymous ? "" : user.firstName;

    /*
     * Check if this user has already created a convo on this post
     */
    const existingConvos = await rdsClient.executeQuery(
        checkForConvo(user.id, user.hid, pid)
    );

    if (existingConvos.length > 0) {
        throw new Error("User already created convo on this post");
    }

    /*
     * Now grab the post
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

    if (post.uid === uid) {
        throw new Error("Users can't message themselves");
    }

    /*
     * ...And grab the target user
     */
    const targetUser: UserType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: post.uid,
                },
            })
            .promise()
    ).Item as UserType;

    /*
     * Create the table with all its fields in rds
     */
    await rdsClient.executeQuery(
        createConvo(
            cvid,
            pid,
            !!post.cmid ? post.cmid : "",
            time,
            message,
            sid,
            uid,
            ranking2Tier(user.ranking),
            user.ranking,
            sname,
            anonymous,

            targetUser.id,
            ranking2Tier(targetUser.ranking),
            targetUser.ranking,
            targetUser.firstName
        )
    );

    /*
     * Create the initial message
     */
    await dynamoClient
        .put({
            TableName: DIGITARI_MESSAGES,
            Item: {
                id: cvid,
                anonymous,
                content: message,
                time,
                uid: sid,
                tid: targetUser.id,
                user: sname,
            },
        })
        .promise();

    /*
     * Increase the post's response count
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_POSTS,
            Key: {
                id: pid,
            },
            UpdateExpression: `set responseCount = responseCount + :unit,
                                    coin = coin + :cost`,
            ExpressionAttributeValues: {
                ":unit": 1,
                ":cost": post.responseCost,
            },
        })
        .promise();

    try {
        await sendPushAndHandleReceipts(
            targetUser.id,
            PushNotificationType.NewConvo,
            `${cvid}/${pid}`,
            "New convo",
            `You have a new convo about your post: "${post.content}"`,
            dynamoClient
        );
    } catch (e) {}

    return {
        id: cvid,
        pid,
        cmid: post.cmid,

        status: 0,

        initialTime: time.toString(),
        initialMsg: message,

        lastTime: time.toString(),
        lastMsg: message,

        sid,
        stier: ranking2Tier(user.ranking),
        sranking: user.ranking,
        sname,
        sanony: anonymous,
        sviewed: true,

        tid: targetUser.id,
        ttier: ranking2Tier(targetUser.ranking),
        tranking: targetUser.ranking,
        tname: targetUser.firstName,
        tviewed: false,

        targetMsgCount: 0,
    };
}
