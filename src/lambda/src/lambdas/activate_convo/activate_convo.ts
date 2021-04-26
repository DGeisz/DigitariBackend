import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "../dismiss_convo/lambda_types/event_args";
import { ConvoType } from "../../global_types/ConvoTypes";
import { DynamoDB } from "aws-sdk";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { getConvo } from "../dismiss_convo/rds_queries/queries";

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
     * Make sure the convo is new
     */
    if (convo.status !== 0) {
        throw new Error("Only new convos can be activated");
    }

    /*
     * Make sure the user is the convo target
     */
    if (convo.tid !== uid) {
        throw new Error("Only the convo target can activate the convo");
    }

    /*
     * Update rds
     */
    await rdsClient.executeSql(
        `UPDATE convos SET status = 1 WHERE id='${cvid}'`
    );

    /*
     * Update the in-memory convo object
     */
    convo.status = 1;

    /*
     * Blank out suid just for security purposes
     */
    convo.suid = "";

    /*
     * Return the boi
     */
    return convo;
}
