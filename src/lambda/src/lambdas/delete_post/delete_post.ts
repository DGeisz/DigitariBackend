import { DynamoDB, S3 } from "aws-sdk";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "./lambda_types/EventArgs";
import { DIGITARI_POSTS } from "../../global_types/DynamoTableNames";
import { PostType } from "../../global_types/PostTypes";
import { ObjectList } from "aws-sdk/clients/s3";

const BUCKET_NAME = "digitari-imgs";
const MAX_S3_DELETE = 1000;

const s3Client = new S3();
const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(event: AppSyncResolverEvent<EventArgs>) {
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const { pid } = event.arguments;

    /*
     * Start off by fetching the post
     */
    const post = (
        await dynamoClient
            .get({
                TableName: DIGITARI_POSTS,
                Key: {
                    id: pid,
                },
            })
            .promise()
    ).Item as PostType;

    if (!post) {
        throw new Error("Post with this id doesn't exist!");
    }

    /*
     * Make sure the caller is the creator
     * of the post
     */
    if (post.uid !== uid) {
        throw new Error("Can't delete a post that isn't yours!");
    }

    /*
     * Delete any pictures associated with the post
     */
    const objectList: ObjectList = [];
    let nextToken: string | undefined = undefined;

    /*
     * This is a paginated request, so if the post has
     * more than 1,000 pics, we might need to run this
     * more than once
     */
    while (true) {
        /*
         * Make the request
         */
        const listReturn = await s3Client
            .listObjectsV2({
                Bucket: BUCKET_NAME,
                Prefix: pid,
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

    const updatePromises: Promise<any>[] = [];

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
     * Now delete the post from RDS,
     * and set all convos associated with this post to `deleted`
     */
    updatePromises.push(
        rdsClient.executeSql(`UPDATE convos SET status = -3 WHERE pid='${pid}'`)
    );
    updatePromises.push(
        rdsClient.executeSql(`DELETE FROM posts WHERE id='${pid}'`)
    );

    /*
     * Finally, delete the post in dynamo
     */
    updatePromises.push(
        dynamoClient
            .delete({
                TableName: DIGITARI_POSTS,
                Key: {
                    id: pid,
                },
            })
            .promise()
    );

    await Promise.all(updatePromises);

    return true;
}
