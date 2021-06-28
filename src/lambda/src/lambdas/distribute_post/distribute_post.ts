import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { UserType } from "../../global_types/UserTypes";
import {
    DIGITARI_POSTS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { DynamoDB } from "aws-sdk";
import {
    ExtendedPostType,
    PostTarget,
    PostType,
} from "../../global_types/PostTypes";
import { millisInDay } from "../../utils/time_utils";
import { challengeCheck } from "../../challenges/challenge_check";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import {
    getActiveFollowers,
    getInactiveFollowers,
} from "./rds_queries/queries";

const MAX_BATCH_WRITE_ITEMS = 20;
const COST_PER_RECIPIENT = 10;

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const rdsClient = new RdsClient();

interface EventArgs {
    pid: string;
}

export async function handler(event: AppSyncResolverEvent<EventArgs>) {
    const { pid } = event.arguments;
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const time = Date.now();

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
                    id: pid,
                },
            })
            .promise(),
    ]);

    const user = preUser.Item as UserType;
    const post = prePost.Item as ExtendedPostType;

    if (post.uid !== uid) {
        throw new Error("Only user can distribute their own post");
    }

    if (!!post.distributed) {
        throw new Error("This post has already been distributed");
    }

    let finalRecipients = post.recipients;
    const tid = post.target === PostTarget.MyFollowers ? uid : post.cmid;

    /*
     * Get the active time window (within the last three days)
     * and start out by randomly fetching as many active user as you
     * can
     */
    const activeTime = Date.now() - 3 * millisInDay;

    let targetIds = await rdsClient.executeQuery<string>(
        getActiveFollowers(tid, activeTime, finalRecipients)
    );

    /*
     * Now we fetch from inactive followers just to pick up any slack
     */
    if (targetIds.length < finalRecipients) {
        const inactiveTargets = await rdsClient.executeQuery<string>(
            getInactiveFollowers(
                tid,
                activeTime,
                finalRecipients - targetIds.length
            )
        );

        targetIds.push(...inactiveTargets);
    }

    /*
     * Alright, we're going to try 5 times to send out the feed records
     */
    for (let t = 0; t < 5; ++t) {
        const batchPromises: Promise<any>[] = [];

        for (let i = 0; i < targetIds.length; i += MAX_BATCH_WRITE_ITEMS) {
            const writeRequests = [];

            for (let j = 0; j < MAX_BATCH_WRITE_ITEMS; ++j) {
                /*
                 * First check that we haven't reached the end
                 * of targetIds
                 */
                if (j + i >= targetIds.length) {
                    break;
                } else {
                    /*
                     * Otherwise, add a record
                     * to the list of write requests
                     */
                    writeRequests.push({
                        PutRequest: {
                            Item: {
                                uid: targetIds[i + j],
                                time,
                                pid,
                            },
                        },
                    });
                }
            }

            batchPromises.push(
                dynamoClient
                    .batchWrite({
                        RequestItems: {
                            DigitariFeedRecords: writeRequests,
                        },
                    })
                    .promise()
            );
        }

        try {
            await Promise.all(batchPromises);

            /*
             * If all the above promises successfully resolved,
             * break out of the retry loop, and go on our merry way
             */
            break;
        } catch (_) {
            /*
             * If we hit an error, then we simply try again, up to 5 times
             */
        }
    }
    const updatePromises: Promise<any>[] = [];
    const finalPromises: Promise<any>[] = [];

    /*
     * Mark post as distributed
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_POSTS,
                Key: {
                    id: pid,
                },
                UpdateExpression: `set distributed = :t`,
                ExpressionAttributeValues: {
                    ":t": true,
                },
            })
            .promise()
    );

    /*
     * Now charge the user for the transaction
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set coin = coin - :price,
                                   coinSpent = coinSpent + :price,
                                   postCount = postCount + :unit`,
                ExpressionAttributeValues: {
                    ":price": COST_PER_RECIPIENT * finalRecipients,
                    ":unit": 1,
                },
            })
            .promise()
    );

    finalPromises.push(Promise.all(updatePromises));

    user.coin -= COST_PER_RECIPIENT * finalRecipients;
    user.coinSpent += COST_PER_RECIPIENT * finalRecipients;
    user.postCount += 1;

    /*
     * Handle challenge updates
     */
    finalPromises.push(challengeCheck(user, dynamoClient));

    const finalResolution = await Promise.allSettled(finalPromises);

    if (finalResolution[0].status === "rejected") {
        throw new Error(finalResolution[0].reason);
        // throw new Error("Ran into an error on the backend. Sorry, boo!");
    }

    return true;
}
