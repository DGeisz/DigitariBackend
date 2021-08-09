import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "../dismiss_convo/lambda_types/event_args";
import {
    ConvoUpdate,
    MESSAGE_COUNT_THRESHOLD,
} from "../../global_types/ConvoTypes";
import { getConvo } from "../dismiss_convo/rds_queries/queries";
import {
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";
import {
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { UserType } from "../../global_types/UserTypes";

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
     * Make sure we're above the convo threshold
     */
    if (uid === convo.suid) {
        if (convo.targetMsgCount < MESSAGE_COUNT_THRESHOLD) {
            throw new Error(
                "Source user can't finish the convo because target user hasn't sent enough messages!"
            );
        }
    } else {
        if (convo.sourceMsgCount < MESSAGE_COUNT_THRESHOLD) {
            throw new Error(
                "Target user can't finish the convo because source user hasn't sent enough messages!"
            );
        }
    }

    const [preSource, preTarget] = await Promise.all([
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: convo.suid,
                },
            })
            .promise(),
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: convo.tid,
                },
            })
            .promise(),
    ]);

    const source = preSource.Item as UserType;
    const target = preTarget.Item as UserType;

    const updatePromises: Promise<any>[] = [];
    const finalPromises: Promise<any>[] = [];

    /*
     * Update rds
     */
    updatePromises.push(
        rdsClient.executeSql(`UPDATE convos SET status = 2 WHERE id='${cvid}'`)
    );

    /*
     * Increase both user's successful convo count and ranking,
     * and also give source user the convo reward
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: convo.suid,
                },
                UpdateExpression: `set successfulConvos = successfulConvos + :unit,
                                       ranking = ranking + :unit,
                                       levelSuccessfulConvos = levelSuccessfulConvos + :unit,
                                       newTransactionUpdate = :b`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":b": true,
                },
            })
            .promise()
    );

    source.successfulConvos += 1;
    source.ranking += 1;
    source.newTransactionUpdate = true;

    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: convo.tid,
                },
                UpdateExpression: `set successfulConvos = successfulConvos + :unit,
                                       ranking = ranking + :unit,
                                       levelSuccessfulConvos = levelSuccessfulConvos + :unit,
                                       newTransactionUpdate = :b`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":b": true,
                },
            })
            .promise()
    );

    target.successfulConvos += 1;
    target.ranking += 1;
    target.newTransactionUpdate = true;

    const time = Date.now();

    const sourceMessage =
        uid === convo.suid
            ? `You successfully finished your convo with ${convo.tname}`
            : `${convo.tname} successfully finished your convo`;

    /*
     * Create transaction for this bad boi
     */
    const sourceTransaction: TransactionType = {
        tid: convo.suid,
        time,
        coin: 0,
        message: sourceMessage,
        transactionType: TransactionTypesEnum.Convo,
        transactionIcon: TransactionIcon.Convo,
        data: `${cvid}:${convo.pid}`,
        ttl: Math.round(time / 1000) + TRANSACTION_TTL,
    };

    /*
     * Send off the transaction
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_TRANSACTIONS,
                Item: sourceTransaction,
            })
            .promise()
    );

    let targetMessage: string;

    if (uid === convo.tid) {
        if (convo.sanony) {
            targetMessage = `You successfully finished a convo`;
        } else {
            targetMessage = `You successfully finished your convo with ${convo.sname}`;
        }
    } else {
        if (convo.sanony) {
            targetMessage = `Your convo was successfully finished`;
        } else {
            targetMessage = `${convo.sname} successfully finished your convo`;
        }
    }

    /*
     * Create transaction for this bad boi
     */
    const targetTransaction: TransactionType = {
        tid: convo.tid,
        time,
        coin: 0,
        message: targetMessage,
        transactionType: TransactionTypesEnum.Convo,
        transactionIcon: TransactionIcon.Convo,
        data: `${cvid}:${convo.pid}`,
        ttl: Math.round(time / 1000) + TRANSACTION_TTL,
    };

    /*
     * Send off the transaction
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_TRANSACTIONS,
                Item: targetTransaction,
            })
            .promise()
    );

    finalPromises.push(Promise.all(updatePromises));

    /*
     * Send push notifications to the target
     */
    const pushMessage =
        convo.tid === uid
            ? `${convo.tname} finished your convo!`
            : convo.sanony
            ? `Your convo successfully finished!`
            : `${convo.sname} finished your convo!`;

    finalPromises.push(
        sendPushAndHandleReceipts(
            convo.tid === uid ? convo.suid : convo.tid,
            PushNotificationType.ConvoFinished,
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
        //     "Server error, and it's probably none of your business"
        // );
    }

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
