import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "../dismiss_convo/lambda_types/event_args";
import { ConvoType } from "../../global_types/ConvoTypes";
import { DynamoDB } from "aws-sdk";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { getConvo } from "../dismiss_convo/rds_queries/queries";
import {
    DIGITARI_POSTS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { PostType } from "../../global_types/PostTypes";
import { UserType } from "../../global_types/UserTypes";

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
     * Get the user and post
     */
    const [preUser, prePost] = await Promise.all([
        dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
            })
            .promise(),
        dynamoClient
            .get({
                TableName: DIGITARI_POSTS,
                Key: {
                    id: convo.pid,
                },
            })
            .promise(),
    ]);

    const user = preUser.Item as UserType;
    const post = prePost.Item as PostType;

    /*
     * Check to make sure target has sufficient bolts to activate
     * the convo
     */
    if (user.bolts < post.responseCost) {
        throw new Error(
            "User doesn't have enough bolts to activate the conversation"
        );
    }

    const updatePromises: Promise<any>[] = [];

    /*
     * Update rds
     */
    updatePromises.push(
        rdsClient.executeSql(`UPDATE convos SET status = 1 WHERE id='${cvid}'`)
    );

    /*
     * Decrease the user's bolts by response cost
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

    /*
     * Increase the post's convo count
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_POSTS,
                Key: {
                    id: convo.pid,
                },
                UpdateExpression: `set convoCount = convoCount + :unit`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise()
    );

    await Promise.all(updatePromises);

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
