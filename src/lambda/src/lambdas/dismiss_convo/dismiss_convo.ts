import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { getConvo } from "./rds_queries/queries";
import { EventArgs } from "./lambda_types/event_args";
import { ConvoType } from "../../global_types/ConvoTypes";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";
import {
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { DIGITARI_TRANSACTIONS } from "../../global_types/DynamoTableNames";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<ConvoType> {
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const { cvid } = event.arguments;

    /*
     * Start off by fetching the convo in question
     */
    const convo = (await rdsClient.executeQuery(getConvo(cvid)))[0];

    /*
     * Make sure you are the convo target
     */
    if (convo.tid !== uid) {
        throw new Error("Only the convo target can dismiss a convo");
    }

    /*
     * Make sure the convo hasn't already been dismissed
     */
    if (convo.status !== 0) {
        throw new Error("Convo must be new in order to be dismissed!");
    }

    /*
     * Now, update the convo's status
     */
    await rdsClient.executeSql(
        `UPDATE convos SET status = -2 WHERE id='${cvid}'`
    );

    const time = Date.now();
    const pushMessage = `${convo.tname} dismissed your response: "${convo.lastMsg}"`;

    /*
     * Create transaction for this bad boi
     */
    const transaction: TransactionType = {
        tid: convo.suid,
        time,
        coin: 0,
        message: pushMessage,
        transactionType: TransactionTypesEnum.Convo,
        data: `${cvid}:${convo.pid}`,
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
     * Change the convo's status in the in memory object, and then
     * return the object
     */
    try {
        await sendPushAndHandleReceipts(
            convo.suid,
            PushNotificationType.ConvoDismissed,
            `${cvid}/${convo.pid}`,
            "Convo dismissed",
            pushMessage,
            dynamoClient
        );
    } catch (e) {}

    convo.status = -2;
    convo.suid = "";

    return convo;
}
