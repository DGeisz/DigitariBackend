import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { getConvo } from "./rds_queries/queries";
import { EventArgs } from "./lambda_types/event_args";
import { ConvoType } from "../../global_types/ConvoTypes";
import {
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import {
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";

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

    const updatePromises: Promise<any>[] = [];

    /*
     * Now, update the convo's status
     */
    updatePromises.push(
        rdsClient.executeSql(`UPDATE convos SET status = -2 WHERE id='${cvid}'`)
    );

    const time = Date.now();
    const pushMessage = `${convo.tname} dismissed your response: "${convo.lastMsg}"`;

    /*
     * Flag the source's new transaction update
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: convo.suid,
                },
                UpdateExpression: `set newTransactionUpdate = :b`,
                ExpressionAttributeValues: {
                    ":b": true,
                },
            })
            .promise()
    );

    /*
     * Create transaction for this bad boi
     */
    const transaction: TransactionType = {
        tid: convo.suid,
        time,
        coin: 0,
        message: pushMessage,
        transactionType: TransactionTypesEnum.Convo,
        transactionIcon: TransactionIcon.Convo,
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

    await Promise.all(updatePromises);

    convo.status = -2;
    convo.suid = "";

    return convo;
}
