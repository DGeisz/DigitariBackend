import { DynamoDB } from "aws-sdk";
import { DIGITARI_USERS } from "../../global_types/DynamoTableNames";
import { UserType } from "../../global_types/UserTypes";

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler() {
    const users = (
        await dynamoClient
            .scan({
                TableName: DIGITARI_USERS,
            })
            .promise()
    ).Items as UserType[];

    const updatePromises: Promise<any>[] = [];

    for (let user of users) {
        updatePromises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_USERS,
                    Key: {
                        id: user.id,
                    },
                    UpdateExpression: `set bolts = :z`,
                    ExpressionAttributeValues: {
                        ":z": 0,
                    },
                })
                .promise()
        );
    }

    await Promise.all(updatePromises);
}
