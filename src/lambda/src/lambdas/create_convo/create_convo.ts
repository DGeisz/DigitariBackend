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
     * Make sure the source user has enough bolts
     */
    if (user.bolts < post.responseCost) {
        throw new Error("User doesn't have enough bolts");
    }

    /*
     * ...And grab the target user
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
    ).Item as UserType | null;

    const updatePromises: Promise<any>[] = [];
    const finalPromises: Promise<any>[] = [];

    let tid: string;
    let tranking: number;
    let ttier: number;
    let tname: string;

    if (!!targetUser) {
        tid = targetUser.id;
        tranking = targetUser.ranking;
        tname = targetUser.firstName;
        ttier = ranking2Tier(targetUser.ranking);

        updatePromises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_USERS,
                    Key: {
                        id: targetUser.id,
                    },
                    UpdateExpression: `set newConvoUpdate = :b`,
                    ExpressionAttributeValues: {
                        ":b": true,
                    },
                })
                .promise()
        );
    } else {
        tid = post.uid;
        ttier = post.tier;
        tranking = 0;
        tname = post.user;
    }

    /*
     * Create the table with all its fields in rds
     */
    updatePromises.push(
        rdsClient.executeQuery(
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

                tid,
                ttier,
                tranking,
                tname,

                post.responseCost,
                post.convoReward
            )
        )
    );

    /*
     * Decrease the callers bolts
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set bolts = bolts - :price`,
                ExpressionAttributeValues: {
                    ":price": post.responseCost,
                },
            })
            .promise()
    );

    user.bolts -= post.responseCost;

    /*
     * Create the initial message
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_MESSAGES,
                Item: {
                    id: cvid,
                    anonymous,
                    content: message,
                    time,
                    uid: sid,
                    tid,
                    user: sname,
                },
            })
            .promise()
    );

    /*
     * Increase the post's response count
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_POSTS,
                Key: {
                    id: pid,
                },
                UpdateExpression: `set responseCount = responseCount + :unit`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise()
    );

    finalPromises.push(Promise.all(updatePromises));

    finalPromises.push(
        sendPushAndHandleReceipts(
            tid,
            PushNotificationType.NewConvo,
            `${cvid}/${pid}`,
            "",
            `Your post received a new response: "${message}"`,
            dynamoClient
        )
    );

    const finalResolution = await Promise.allSettled(finalPromises);

    if (finalResolution[0].status === "rejected") {
        throw new Error(finalResolution[0].reason);
        // throw new Error("There was a server error, baby!");
    }

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
        sourceMsgCount: 1,

        tid,
        ttier,
        tranking,
        tname,
        tviewed: false,

        targetMsgCount: 0,
        responseCost: post.responseCost,
        convoReward: post.convoReward,
    };
}
