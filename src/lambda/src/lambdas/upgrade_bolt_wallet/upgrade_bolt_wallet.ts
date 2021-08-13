import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import {
    calculateBoltWalletUpgrade,
    UserType,
} from "../../global_types/UserTypes";
import { DIGITARI_USERS } from "../../global_types/DynamoTableNames";

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<any>
): Promise<UserType> {
    const uid = (event.identity as AppSyncIdentityCognito).sub;

    /*
     * Grab the user
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

    if (!user) {
        throw new Error("User doesn't exist!");
    }

    /*
     * Calculate upgrade
     */
    const [nextPrice, nextSize] = calculateBoltWalletUpgrade(
        user.maxBoltWallet
    );

    if (user.bolts < nextSize) {
        throw new Error("User doesn't have enough bolts");
    }

    /*
     * Do the upgrade
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: uid,
            },
            UpdateExpression: `set maxBoltWallet = :s, bolts = bolts - :price`,
            ExpressionAttributeValues: {
                ":s": nextSize,
                ":price": nextPrice,
            },
        })
        .promise();

    /*
     * Update in-memory object
     */
    user.maxBoltWallet = nextSize;
    user.bolts -= nextPrice;

    return user;
}
