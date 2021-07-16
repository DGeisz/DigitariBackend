import { calculateWalletUpgrade, UserType } from "../../global_types/UserTypes";
import { DIGITARI_USERS } from "../../global_types/DynamoTableNames";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";

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
    const [nextPrice, nextSize] = calculateWalletUpgrade(user.maxWallet);

    if (user.bolts < nextPrice) {
        throw new Error("User doesn't have enough bolts!");
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
            UpdateExpression: `set maxWallet = :s, bolts = bolts - :price`,
            ExpressionAttributeValues: {
                ":s": nextSize,
                ":price": nextPrice,
            },
        })
        .promise();

    /*
     * Update in memory object
     */
    user.maxWallet = nextSize;

    return user;
}
