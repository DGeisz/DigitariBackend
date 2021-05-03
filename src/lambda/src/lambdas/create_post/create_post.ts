import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB, S3 } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "./lambda_types/event_type";
import {
    POST_ADD_ON_CONTENT_MAX_LEN,
    POST_CONTENT_MAX_LEN,
    PostAddOn,
    PostTarget,
    PostType,
} from "../../global_types/PostTypes";
import { UserType } from "../../global_types/UserTypes";
import {
    DIGITARI_COMMUNITIES,
    DIGITARI_POSTS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { CommunityType } from "../../global_types/CommunityTypes";
import { v4 } from "uuid";
import { randomString } from "../../utils/string_utils";
import {
    getActiveFollowers,
    getInactiveFollowers,
} from "./rds_queries/queries";
import { millisInDay } from "../../utils/time_utils";
import { tier2convoReward, tier2responseCost } from "../../utils/tier_utils";
import { ranking2Tier } from "../../global_types/TierTypes";
import { challengeCheck } from "../../challenges/challenge_check";

const BUCKET_NAME = "digitari-imgs";
const s3Client = new S3();
const MAX_BATCH_WRITE_ITEMS = 20;

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(event: AppSyncResolverEvent<EventArgs>) {
    const {
        target,
        addOnContent,
        content,
        cmid,
        addOn,
        recipients,
    } = event.arguments;

    let finalAddOnContent = addOnContent;
    let finalRecipients = recipients;

    const pid = v4();
    const time = Date.now();
    const uid = (event.identity as AppSyncIdentityCognito).sub;

    /*
     * Start off with the tid being the users id.
     * If the user's posting to a community, we'll change it later
     */
    let tid = uid;

    /*
     * Do basic content length check
     */
    if (
        content.length > POST_CONTENT_MAX_LEN ||
        addOnContent.length > POST_ADD_ON_CONTENT_MAX_LEN
    ) {
        throw new Error("Either content or addOnContent is too long");
    }

    if (recipients < 1) {
        throw new Error("Must post to at least one recipient");
    }

    /*
     * Fetch user
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

    let community: CommunityType;

    if (target === PostTarget.Community) {
        if (!!cmid) {
            /*
             * Change tid to cmid because obviously that's
             * who we'll be fetching from
             */
            tid = cmid;

            community = (
                await dynamoClient
                    .get({
                        TableName: DIGITARI_COMMUNITIES,
                        Key: {
                            id: cmid,
                        },
                    })
                    .promise()
            ).Item as CommunityType;

            if (!community) {
                throw new Error("Cmid didn't correspond to a community");
            }
        } else {
            throw new Error(
                "Specified target is a community, but didn't specify community id"
            );
        }
    }

    /*
     * Alright, now we're seeing if we need to generate a presigned url
     */
    let presignedUrl: string;

    if (addOn === PostAddOn.Image) {
        /*
         * Generate presigned url for this post
         */
        if (!addOnContent.match(/\.(jpg|jpeg|png)$/)) {
            throw new Error("Not a correct file type for addOn image");
        }

        const imgSplit = addOnContent.split(".");
        const imgType = imgSplit[imgSplit.length - 1];

        const imgKey = `${pid}/p-${randomString(3)}.${imgType}`;

        presignedUrl = s3Client.getSignedUrl("putObject", {
            Bucket: BUCKET_NAME,
            Key: imgKey,
        });

        finalAddOnContent = `https://d3671gkd53urlb.cloudfront.net/${imgKey}`;
    }

    /*
     * Now we see how we're looking in terms of post target
     *
     * Our policy for posting is this: If the user requests more
     * recipients than the target has followers, then we simply decrease
     * the recipients to match the followers.  This sort of behavior should
     * have been stopped on client, so this shouldn't lead to bad UX for the
     * user
     */
    if (target === PostTarget.MyFollowers) {
        finalRecipients = Math.min(recipients, user.followers);
    } else {
        finalRecipients = Math.min(recipients, community.followers);
    }

    /*
     * Do a coin check to be sure the user has enough coin to
     * go through with this
     */
    if (finalRecipients > user.coin) {
        throw new Error("Trying to send post to more users than OP has coin");
    }

    const userTier = ranking2Tier(user.ranking);

    const responseCost = tier2responseCost(userTier);
    const convoReward = tier2convoReward(userTier);

    const post: PostType = {
        id: pid,
        uid,

        user: user.firstName,
        tier: userTier,
        time: time.toString(),
        content,
        coinDonated: false,

        addOn,
        addOnContent: finalAddOnContent,
        target,
        cmid,
        communityName: community?.name,
        responseCost,
        convoReward,

        coin: 0,
        convoCount: 0,
        responseCount: 0,
    };

    /*
     * Ok, so now we're going to start out by actually making the post
     */
    await dynamoClient
        .put({
            TableName: DIGITARI_POSTS,
            Item: {
                id: pid,
                uid,

                user: user.firstName,
                tier: ranking2Tier(user.ranking),
                time,
                content,

                addOn,
                addOnContent: finalAddOnContent,
                target,
                cmid,
                communityName: community?.name,
                responseCost,
                convoReward,

                coin: 0,
                convoCount: 0,
                responseCount: 0,
            },
        })
        .promise();

    /*
     * Add the entry to the posts table
     */
    if (!!cmid) {
        await rdsClient.executeSql(`INSERT INTO posts (uid, cmid, id, tier, time)
                                        VALUES ('${uid}', '${cmid}', '${pid}', '${userTier}', ${time});`);
    } else {
        await rdsClient.executeSql(`INSERT INTO posts (uid, id, tier, time)
                                        VALUES ('${uid}', '${pid}', '${userTier}', ${time});`);
    }

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

        targetIds = targetIds.concat(inactiveTargets);
    }

    /*
     * Now we do a series of batch writes to get all these
     * suckers into dynamo
     */
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

        await dynamoClient
            .batchWrite({
                RequestItems: {
                    DigitariFeedRecords: writeRequests,
                },
            })
            .promise();
    }

    /*
     * Now charge the user for the transaction
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: uid,
            },
            UpdateExpression: `set coin = coin - :price,
                                   coinSpent = coinSpent + :price,
                                   postCount = postCount + :unit`,
            ExpressionAttributeValues: {
                ":price": finalRecipients,
                ":unit": 1,
            },
        })
        .promise();

    user.coin -= finalRecipients;
    user.coinSpent += finalRecipients;
    user.postCount += 1;

    /*
     * Handle challenge updates
     */
    try {
        await challengeCheck(user, dynamoClient);
    } catch (e) {}

    return {
        post,
        presignedUrl,
    };
}
