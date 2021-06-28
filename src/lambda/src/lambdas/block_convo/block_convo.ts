import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "../dismiss_convo/lambda_types/event_args";
import { ConvoUpdate } from "../../global_types/ConvoTypes";
import { getConvo } from "../dismiss_convo/rds_queries/queries";
import {
    DIGITARI_POSTS,
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";
import {
    TRANSACTION_TTL,
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<ConvoUpdate> {
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const { cvid } = event.arguments;

    const convo = (await rdsClient.executeQuery(getConvo(cvid)))[0];

    /*
     * Only allow a convo to be blocked if it's new or active
     */
    if (!(convo.status === 0 || convo.status === 1)) {
        throw new Error("Only new and active convos can be blocked");
    }

    /*
     * Make sure the user is either the source or target
     */
    if (!(convo.suid === uid || convo.tid === uid)) {
        throw new Error("Only convo participants can block a convo");
    }

    /*
     * Prevent anyone from blocking a new convo, unless
     * the user is the convo target
     */
    if (uid !== convo.tid && convo.status !== 0) {
        throw new Error("Only the convo target can block a new convo");
    }

    const updatePromises: Promise<any>[] = [];

    /*
     * Update rds
     */
    updatePromises.push(
        rdsClient.executeSql(`UPDATE convos SET status = -1 WHERE id='${cvid}'`)
    );

    /*
     * Update users big three values and overall ranking
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set blocked = blocked + :unit,
                                    ranking = ranking - :unit`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise()
    );

    /*
     * Update other user, flag new transaction update
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid === convo.tid ? convo.suid : convo.tid,
                },
                UpdateExpression: `set beenBlocked = beenBlocked + :unit,
                                    ranking = ranking - :unit,
                                    newTransactionUpdate = :b`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":b": true,
                },
            })
            .promise()
    );

    /*
     * If the convo is active (status = 1), and the
     * targetMsgCount is zero, then the convo goes
     * from a visible status to a non-visible status.
     * Thus we need to decrease the convoCount so that
     * it properly corresponds with the number of visible
     * convos
     */
    if (convo.targetMsgCount === 0 && convo.status === 1) {
        updatePromises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_POSTS,
                    Key: {
                        id: convo.pid,
                    },
                    UpdateExpression: `set convoCount = convoCount - :unit`,
                    ExpressionAttributeValues: {
                        ":unit": 1,
                    },
                })
                .promise()
        );
    }

    const pushMessage =
        convo.tid === uid
            ? `${convo.tname} blocked your message: "${convo.lastMsg}"`
            : convo.sanony
            ? `Your message was blocked: "${convo.lastMsg}"`
            : `${convo.sname} blocked your message: "${convo.lastMsg}"`;

    const time = Date.now();

    /*
     * Create transaction for this bad boi
     */
    const transaction: TransactionType = {
        tid: convo.tid === uid ? convo.suid : convo.tid,
        time,
        coin: 0,
        message: pushMessage,
        transactionType: TransactionTypesEnum.Convo,
        data: `${cvid}:${convo.pid}`,
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

    const finalPromises: Promise<any>[] = [];

    finalPromises.push(Promise.all(updatePromises));

    /*
     * Send push notifications to the target
     */
    finalPromises.push(
        sendPushAndHandleReceipts(
            convo.tid === uid ? convo.suid : convo.tid,
            PushNotificationType.ConvoBlocked,
            `${cvid}/${convo.pid}`,
            "",
            pushMessage,
            dynamoClient
        )
    );

    const finalResolution = await Promise.allSettled(finalPromises);

    if (finalResolution[0].status === "rejected") {
        throw new Error(finalResolution[0].reason);
        // throw new Error(
        //     "Server error, and there's nothing you can do about it"
        // );
    }

    /*
     * Update in memory convo object and return it
     */
    convo.status = -1;
    convo.suid = "";

    return {
        convo,
        tid: uid === convo.tid ? convo.sid : convo.tid,
    };
}
