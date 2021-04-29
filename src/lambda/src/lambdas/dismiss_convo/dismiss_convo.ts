import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { getConvo } from "./rds_queries/queries";
import { EventArgs } from "./lambda_types/event_args";
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

    /*
     * Change the convo's status in the in memory object, and then
     * return the object
     */

    convo.status = -2;

    try {
        await sendPushAndHandleReceipts(
            convo.suid,
            PushNotificationType.ConvoDismissed,
            cvid,
            "Convo dismissed",
            `${convo.tname} dismissed your response: "${convo.lastMsg}"`,
            dynamoClient
        );
    } catch (e) {}

    return convo;
}
