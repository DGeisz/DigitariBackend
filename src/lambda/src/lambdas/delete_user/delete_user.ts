import { DynamoDB, S3, CognitoIdentityServiceProvider } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { UserType } from "../../global_types/UserTypes";
import {
    DIGITARI_PUSH,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { UserToken } from "../../global_types/PushTypes";
import { ObjectList } from "aws-sdk/clients/s3";
import { MAX_BATCH_WRITE_ITEMS } from "../../global_constants/aws_constants";
import { Client } from "@elastic/elasticsearch";

const BUCKET_NAME = "digitari-imgs";
const MAX_S3_DELETE = 1000;

const s3Client = new S3();
const rdsClient = new RdsClient();
const cognito = new CognitoIdentityServiceProvider();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    cloud: {
        id: process.env.ES_CLOUD_ID,
    },
    auth: {
        username: process.env.ES_CLOUD_USERNAME,
        password: process.env.ES_CLOUD_PASSWORD,
    },
});

export async function handler(event: AppSyncResolverEvent<{}>) {
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

    const updatePromises: Promise<any>[] = [];

    /*
     * Now we're going to delete the user in RDS
     */
    updatePromises.push(
        rdsClient.executeSql(`DELETE FROM users WHERE id = "${uid}"`)
    );

    /*
     * Delete all follows relationships associated with this user
     */
    updatePromises.push(
        rdsClient.executeSql(
            `DELETE FROM follows WHERE tid = "${uid}" OR sid = "${uid}"`
        )
    );

    /*
     * Now we're going to delete all the push tokens associated
     * with this user.
     *
     * So first, we get the push tokens...
     */
    const userTokens: UserToken[] = (
        await dynamoClient
            .query({
                KeyConditionExpression: "uid = :uid",
                ExpressionAttributeValues: {
                    ":uid": uid,
                },
                TableName: DIGITARI_PUSH,
            })
            .promise()
    ).Items as UserToken[];

    /*
     * And now we delete them in batches
     */
    for (let i = 0; i < userTokens.length; i += MAX_BATCH_WRITE_ITEMS) {
        const writeRequests = [];

        for (let k = 0; k < MAX_BATCH_WRITE_ITEMS; k++) {
            /*
             * Make sure we haven't reached the end of the list
             * of tokens
             */
            if (i + k >= userTokens.length) {
                break;
            } else {
                writeRequests.push({
                    DeleteRequest: {
                        Key: {
                            uid,
                            token: userTokens[i + k].token,
                        },
                    },
                });
            }

            /*
             * Now perform the batch
             * request
             */
            if (writeRequests.length > 0) {
                updatePromises.push(
                    dynamoClient
                        .batchWrite({
                            RequestItems: {
                                DigitariPush: writeRequests,
                            },
                        })
                        .promise()
                );
            }
        }
    }

    /*
     * Ok, now we have to delete all the user's
     * profile pictures.
     *
     * Start off by listing all the user's profile pics
     */
    const objectList: ObjectList = [];
    let nextToken: string | undefined = undefined;

    /*
     * This is a paginated request, so if the user has had
     * more than 1,000 profile pics, we might need to run this
     * more than once
     */
    while (true) {
        /*
         * Make the request
         */
        const listReturn = await s3Client
            .listObjectsV2({
                Bucket: BUCKET_NAME,
                Prefix: uid,
                ContinuationToken: nextToken,
            })
            .promise();

        if (!!listReturn.Contents) {
            /*
             * If the return actually has any contents,
             * add those contents to our list of objects
             */
            objectList.push(...listReturn.Contents);

            /*
             * If the return has a continuation token,
             * then we set the next token and loop,
             * otherwise, break out of the loop
             */
            if (!!listReturn.NextContinuationToken) {
                nextToken = listReturn.NextContinuationToken;
            } else {
                break;
            }
        } else {
            /*
             * If the return doesn't have any contents
             * then we immediately break out of
             * the loop
             */
            break;
        }
    }

    /*
     * Now filter and map this list to create a list of
     * identifiable objects
     */
    const objectKeys = objectList
        .filter((object) => !!object.Key)
        .map((object) => ({
            Key: object.Key,
        }));

    /*
     * Ok, now that we actually have the objects, let's delete them.
     * We have to do this in batches of MAX_S3_DELETE
     */
    for (let i = 0; i < objectKeys.length; i += MAX_S3_DELETE) {
        updatePromises.push(
            s3Client
                .deleteObjects({
                    Bucket: BUCKET_NAME,
                    Delete: {
                        Objects: objectKeys.slice(
                            i * MAX_S3_DELETE,
                            (i + 1) * MAX_S3_DELETE
                        ),
                    },
                })
                .promise()
        );
    }

    /*
     * Now delete the user in elastic search
     */
    updatePromises.push(
        esClient.deleteByQuery({
            index: "search",
            body: {
                query: {
                    match: {
                        id: uid,
                    },
                },
            },
        })
    );

    /*
     * Ok, now we have to delete this user in cognito
     */
    updatePromises.push(
        cognito
            .adminDeleteUser({
                UserPoolId: process.env.POOL_ID,
                Username: user.email,
            })
            .promise()
    );

    /*
     * To wrap this up, let's delete the user in
     * dynamo
     */
    updatePromises.push(
        dynamoClient
            .delete({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
            })
            .promise()
    );

    await Promise.all(updatePromises);

    return true;
}
