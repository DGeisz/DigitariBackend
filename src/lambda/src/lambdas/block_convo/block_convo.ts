import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "../dismiss_convo/lambda_types/event_args";
import { ConvoType } from "../../global_types/ConvoTypes";
import { getConvo } from "../dismiss_convo/rds_queries/queries";
import { DIGITARI_USERS } from "../../global_types/DynamoTableNames";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<ConvoType> {
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

    /*
     * Update rds
     */
    await rdsClient.executeSql(
        `UPDATE convos SET status = -1 WHERE id='${cvid}'`
    );

    /*
     * Update users big three values and overall ranking
     */
    await dynamoClient
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
        .promise();

    /*
     * Update other user
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: uid === convo.tid ? convo.suid : convo.tid,
            },
            UpdateExpression: `set beenBlocked = beenBlocked + :unit,
                                    ranking = ranking - :unit`,
            ExpressionAttributeValues: {
                ":unit": 1,
            },
        })
        .promise();

    /*
     * Update in memory convo object and return it
     */
    convo.status = -1;
    convo.suid = "";

    return convo;
}
