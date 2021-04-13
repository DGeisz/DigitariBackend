import { DynamoDB } from "aws-sdk";
import {
    AppSyncIdentityCognito,
    AppSyncResolverEvent,
    Context,
} from "aws-lambda";
import { v4 } from "uuid";
import { EventArgs } from "./lambda_types/event_type";
import { UserType } from "../../global_types/UserTypes";
import { PostType } from "../../global_types/PostTypes";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import {
    getAllActivityGroupFollowers,
    getAllActivityGroupFollowersByTier,
    getAllFollowersQueryPackage,
    getRandomActivityGroupFollowers,
    getRandomActivityGroupFollowersByTier,
} from "./rds_queries/queries";
import {
    getTierPostAllocation,
    selectWeightedRandomActivityGroup,
    sumReduce,
} from "./utils";
import { CommunityType } from "../../global_types/CommunityTypes";
import { WriteRequests } from "aws-sdk/clients/dynamodb";
import { FeedRecord2DynamoJson } from "../../global_types/FeedRecordTypes";
import { ranking2Tier } from "../../utils/tier_utils";

const MAX_BATCH_WRITE_ITEMS = 25;

/*
 * Initialize the clients we use to access our services
 */
const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

/**
 * Handles the creation and distribution of a new post
 */
export async function handler(
    event: AppSyncResolverEvent<EventArgs>,
    _context: Context
) {
    const uid = (event.identity as AppSyncIdentityCognito).sub;

    /*
     * Fetch the user doing the posting
     */
    const user: UserType = (
        await dynamoClient
            .get({
                TableName: "DigitariUsers",
                Key: {
                    id: uid,
                },
            })
            .promise()
    ).Item as UserType;

    const pid = v4();
    const currentTime = Date.now();

    /*
     * Now then, create the actual post
     */
    const newPost: PostType = {
        id: pid,
        user: user.firstName,
        uid: user.id,
        ranking: user.ranking,
        time: currentTime,

        content: event.arguments.content,
        link: event.arguments.link,
        convoReward: event.arguments.convoReward,
        responseCost: event.arguments.responseCost,

        coin: 0,
        convos: [],
    };

    /*
     * List of the ids of all users to whom this post
     * will be sent
     */
    let targetIds: string[] = [];

    /*
     * Use this to keep track if the user has enough coin
     * to complete the transaction
     */
    let userRemainingCoin = user.coin;

    /*
     * Now then, fetch the ids of users that
     * will receive this post
     *
     * First, if the user wants to post to his
     * followers, fetch the ids of this user's followers
     */
    if (event.arguments.post2Followers) {
        /*
         * Check to be sure user has enough coin,
         * and if so, deduct the price of posting to
         * the community from this user's remaining coin
         */
        if (
            userRemainingCoin >
            event.arguments.numUserFollowers * user.postPrice
        ) {
            userRemainingCoin -=
                event.arguments.numUserFollowers * user.postPrice;
        } else {
            throw new Error(
                "User doesn't have sufficient coin to complete the transaction"
            );
        }

        /*
         * Now then, check to see if we're distributing to all followers
         *
         * In the case where the user tries to post to more followers than
         * they have, we just decrease the count to the number of followers
         * they do have
         */
        if (event.arguments.numUserFollowers >= user.followers) {
            /*
             * Add the ids of all the followers to the list
             * of users to whom we're sending this post
             */
            targetIds = targetIds.concat(
                await rdsClient.executeQuery<string>(
                    getAllFollowersQueryPackage(uid)
                )
            );
        } else {
            /*
             * If we aren't sending the post to all users, now we
             * have to sample from the the users in this user's
             * activity group
             *
             * Start off by grabbing the array of posts requested for
             * each activity group.  We'll use this to do a weighted
             * random selection of the different activity groups we'll
             * use to choose users that will receive this post.
             *
             * Also set the number of users to whom we still need to
             * send this post
             */
            let postsRequested = user.postsRequestedForActivityGroupings;
            let remainingFollowerTargets = event.arguments.numUserFollowers;

            /*
             * This loop should break before this condition
             * is false, but this check remains here to prevent
             * infinite loops
             */
            while (remainingFollowerTargets > 0) {
                /*
                 * Do the random weighted selection
                 */
                const activityGroupSelection = selectWeightedRandomActivityGroup(
                    postsRequested
                );

                /*
                 * If the selection is negative, that means there
                 * are no remaining users to receive this post, so break the loop
                 */
                if (activityGroupSelection < 0) {
                    break;
                }

                /*
                 * Get the size of the activity group selected
                 */
                const activityGroupSize =
                    user.activityGroupingSize[activityGroupSelection];

                if (activityGroupSize > remainingFollowerTargets) {
                    /*
                     * If the size of the activity group selected is
                     * larger than the number of follow targets remaining,
                     * randomly select ids from that group, and then break
                     */
                    targetIds = targetIds.concat(
                        await rdsClient.executeQuery<string>(
                            getRandomActivityGroupFollowers(
                                uid,
                                activityGroupSelection,
                                remainingFollowerTargets
                            )
                        )
                    );

                    break;
                } else if (activityGroupSize === remainingFollowerTargets) {
                    /*
                     * Fetch all the ids from this activity group, and then break
                     * because there are as many uids in this activity group
                     * as there are requested followers.
                     */
                    targetIds = targetIds.concat(
                        await rdsClient.executeQuery<string>(
                            getAllActivityGroupFollowers(
                                uid,
                                activityGroupSelection
                            )
                        )
                    );

                    break;
                } else {
                    /*
                     * In this case, there are fewer ids in this activity group
                     * than remaining targets, so first get all the ids in this activity
                     * group
                     */
                    targetIds = targetIds.concat(
                        await rdsClient.executeQuery<string>(
                            getAllActivityGroupFollowers(
                                uid,
                                activityGroupSelection
                            )
                        )
                    );

                    /*
                     * Now decrease the number of remaining targets by activityGroupSize
                     */
                    remainingFollowerTargets -= activityGroupSize;

                    /*
                     * And finally set the number of post requested for
                     * this activity group to zero so there's zero probability
                     * of this group being selected again
                     */
                    postsRequested[activityGroupSelection] = 0;
                }
            }
        }
    }

    /*
     * If the user wants to post to a community,
     * fetch the ids of users in that community
     * who will receive the post
     */
    if (event.arguments.post2Community) {
        const comm: CommunityType = (
            await dynamoClient
                .get({
                    TableName: "DigitariCommunities",
                    Key: {
                        id: event.arguments.cmid,
                    },
                })
                .promise()
        ).Item as CommunityType;

        /*
         * Add the community information to the post
         */
        newPost.targetCommunity = comm.name;
        newPost.targetCommunityId = comm.id;

        /*
         * Check if the user has enough coin to post
         * to this community as requested, and if so, deduct
         * the price of the post from the user's coin
         */
        if (
            userRemainingCoin >
            event.arguments.numComFollowers * comm.postPrice
        ) {
            userRemainingCoin -=
                event.arguments.numComFollowers * user.postPrice;
        } else {
            throw new Error(
                "User doesn't have sufficient coin to complete the transaction"
            );
        }

        /*
         * Now, first check if we're trying to post to
         * all the followers in the community
         */
        if (event.arguments.numComFollowers >= comm.followers) {
            targetIds = targetIds.concat(
                await rdsClient.executeQuery<string>(
                    getAllFollowersQueryPackage(comm.id)
                )
            );
        } else {
            /*
             * If we're not posting to everyone, the we first need
             * to figure out how many posts we're sending to
             * each tier, and then randomly select ids from the
             * activity groupings of each tier
             */

            /*
             * Get the tier allocation for this user's posting
             */
            const tierAllocation = getTierPostAllocation(
                // comm.postsDesiredByTier,
                comm.postsRequestedForActivityGroupingsByTier.map((tier) =>
                    sumReduce(tier)
                ),
                comm.postsProvidedByTier,
                0.8,
                ranking2Tier(user.ranking),
                event.arguments.numComFollowers
            ) as number[];

            /*
             * Now we're going to loop through the community's tiers, and
             * basically do the exact same thing we did for posting to the users
             * followers, in that we're basically just appending target ids from
             * the activity groups of each tier according to the number of posts
             * allocated to the tier
             */
            for (let tier = 0; tier < tierAllocation.length; ++tier) {
                /*
                 * Start off by grabbing the array of posts requested for
                 * each activity group of the tier.  We'll use this to do a weighted
                 * random selection of the different activity groups we'll
                 * use to choose users that will receive this post.
                 *
                 * Also set the number of users to whom we still need to
                 * send this post in this tier (`remainingFollowerTargets`)
                 */
                let postsRequested =
                    comm.postsRequestedForActivityGroupingsByTier[tier];
                let remainingFollowerTargets = tierAllocation[tier];

                /*
                 * This loop should break before this condition
                 * is false, but this check remains here to prevent
                 * infinite loops
                 */
                while (remainingFollowerTargets > 0) {
                    /*
                     * Do the random weighted selection
                     */
                    const activityGroupSelection = selectWeightedRandomActivityGroup(
                        postsRequested
                    );

                    /*
                     * If the selection is negative, that means there
                     * are no remaining users to receive this post, so break the loop
                     */
                    if (activityGroupSelection < 0) {
                        break;
                    }

                    /*
                     * Get the size of the activity group selected
                     */
                    const activityGroupSize =
                        comm.activityGroupingSizeByTier[tier][
                            activityGroupSelection
                        ];

                    if (activityGroupSize > remainingFollowerTargets) {
                        /*
                         * If the size of the activity group selected is
                         * larger than the number of follow targets remaining,
                         * randomly select ids from that group, and then break
                         */
                        targetIds = targetIds.concat(
                            await rdsClient.executeQuery<string>(
                                getRandomActivityGroupFollowersByTier(
                                    comm.id,
                                    activityGroupSelection,
                                    tier,
                                    remainingFollowerTargets
                                )
                            )
                        );

                        break;
                    } else if (activityGroupSize === remainingFollowerTargets) {
                        /*
                         * Fetch all the ids from this activity group, and then break
                         * because there are as many uids in this activity group
                         * as there are requested followers.
                         */
                        targetIds = targetIds.concat(
                            await rdsClient.executeQuery<string>(
                                getRandomActivityGroupFollowersByTier(
                                    comm.id,
                                    activityGroupSelection,
                                    tier,
                                    remainingFollowerTargets
                                )
                            )
                        );

                        break;
                    } else {
                        /*
                         * In this case, there are fewer ids in this activity group
                         * than remaining targets, so first get all the ids in this activity
                         * group
                         */
                        targetIds = targetIds.concat(
                            await rdsClient.executeQuery<string>(
                                getAllActivityGroupFollowersByTier(
                                    comm.id,
                                    tier,
                                    activityGroupSelection
                                )
                            )
                        );

                        /*
                         * Now decrease the number of remaining targets by activityGroupSize
                         */
                        remainingFollowerTargets -= activityGroupSize;

                        /*
                         * And finally set the number of post requested for
                         * this activity group to zero so there's zero probability
                         * of this group being selected again
                         */
                        postsRequested[activityGroupSelection] = 0;
                    }
                }
            }
        }
    }

    /*
     * We've now fetched all target ids, so the only thing left to do is
     * to create the actual post, and add this post to the target ids' feeds
     */
    await dynamoClient
        .put({
            TableName: "DigitariPosts",
            Item: newPost,
        })
        .promise();

    /*
     * Do a series of batch writes until the record
     * of this post has been inserted into the feeds
     * of all target users
     */
    for (let i = 0; i < targetIds.length; i += MAX_BATCH_WRITE_ITEMS) {
        const writeRequests: WriteRequests = [];

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
                        Item: FeedRecord2DynamoJson({
                            uid: targetIds[i + j],
                            time: currentTime,
                            pid,
                        }),
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
}
