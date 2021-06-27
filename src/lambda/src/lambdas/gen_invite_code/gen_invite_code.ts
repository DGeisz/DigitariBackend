import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { UserType } from "../../global_types/UserTypes";
import {
    DIGITARI_INVITES,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { randomString } from "../../utils/string_utils";
import { InviteType } from "../../global_types/InviteTypes";

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<{}>
): Promise<string> {
    const uid = (event.identity as AppSyncIdentityCognito).sub;

    /*
     * Start off by grabbing user
     */
    const user: UserType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
            })
            .promise()
    ).Item as UserType;

    /*
     * Make sure user still has invites remaining
     */
    if (user.remainingInvites < 1) {
        throw new Error("No invites remaining!");
    }

    let code: string;

    /*
     * Ok, now we generate invite codes, and make sure
     * the code we generate doesn't already exist
     */
    while (true) {
        code = randomString(7, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ");

        /*
         * Attempt to fetch code from invites table
         */
        const invite = (
            await dynamoClient
                .get({
                    TableName: DIGITARI_INVITES,
                    Key: {
                        code,
                    },
                })
                .promise()
        ).Item as InviteType | null;

        if (!invite) {
            /*
             * If invite doesn't exist, we're good to go -- break
             * out of the loop and continue on with the given code
             */
            break;
        }
    }

    const updatePromises: Promise<any>[] = [];

    /*
     * Ok, so first we're going to create an invite with this
     * code and user id
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_INVITES,
                Item: {
                    code,
                    uid,
                    ttl: Math.round(Date.now() / 1000) + 14 * 24 * 60 * 60,
                },
            })
            .promise()
    );

    /*
     * Now we're going to decrease the user's remaining
     * number of invites
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set remainingInvites = remainingInvites - :unit`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise()
    );

    await Promise.all(updatePromises);

    return code;
}
