import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "../dismiss_convo/lambda_types/event_args";
import {
    ConvoType,
    ConvoUpdate,
    TARGET_MESSAGE_COUNT_THRESHOLD,
} from "../../global_types/ConvoTypes";
import { getConvo } from "../dismiss_convo/rds_queries/queries";
import {
    DIGITARI_POSTS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { PostType } from "../../global_types/PostTypes";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<ConvoUpdate> {
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const { cvid } = event.arguments;

    /*
     * Start off by fetching the convo in question
     */
    const convo = (await rdsClient.executeQuery(getConvo(cvid)))[0];

    /*
     * Make sure the convo's active
     */
    if (convo.status !== 1) {
        throw new Error("You can only finish an active convo!");
    }

    /*
     * First make sure we're even a convo participant
     */
    if (uid !== convo.tid && uid !== convo.suid) {
        throw new Error("Only a convo participant can finish a convo");
    }

    /*
     * Now then, if we're the source of the convo, make sure
     * we're above the convo threshold
     */
    if (uid === convo.suid) {
        if (convo.targetMsgCount < TARGET_MESSAGE_COUNT_THRESHOLD) {
            throw new Error(
                "Source user can't finish the convo because target user hasn't sent enough messages!"
            );
        }
    }

    /*
     * Grab a copy of the post for the convo reward
     */
    const post = (
        await dynamoClient
            .get({
                TableName: DIGITARI_POSTS,
                Key: {
                    id: convo.pid,
                },
            })
            .promise()
    ).Item as PostType;

    /*
     * Update rds
     */
    /*
     * Update rds
     */
    await rdsClient.executeSql(
        `UPDATE convos SET status = 2 WHERE id='${cvid}'`
    );

    /*
     * Increase both user's successful convo count and ranking,
     * and also give source user the convo reward
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: convo.suid,
            },
            UpdateExpression: `set coin = coin + :reward,
                                 successfulConvos = successfulConvos + :unit,
                                 ranking = ranking + :unit`,
            ExpressionAttributeValues: {
                ":reward": post.convoReward,
                ":unit": 1,
            },
        })
        .promise();

    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: convo.tid,
            },
            UpdateExpression: `set successfulConvos = successfulConvos + :unit,
                                 ranking = ranking + :unit`,
            ExpressionAttributeValues: {
                ":unit": 1,
            },
        })
        .promise();

    /*
     * Send push notifications to the target
     */
    const pushMessage =
        convo.tid === uid
            ? `${convo.tname} finished your convo!`
            : convo.sanony
            ? `Your convo with an anonymous user was finished!`
            : `${convo.sname} finished your convo!`;

    try {
        await sendPushAndHandleReceipts(
            convo.tid === uid ? convo.suid : convo.tid,
            PushNotificationType.ConvoFinished,
            cvid,
            "Convo finished",
            pushMessage,
            dynamoClient
        );
    } catch (e) {}

    /*
     * Finish things off by setting convo status locally, and scrubbing
     * suid
     */
    convo.status = 2;
    convo.suid = "";

    return {
        convo,
        tid: uid === convo.tid ? convo.sid : convo.tid,
    };
}
