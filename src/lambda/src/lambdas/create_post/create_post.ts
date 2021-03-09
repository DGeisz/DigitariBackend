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
    getAllFollowersQueryPackage,
    getRandomActivityGroupFollowers,
} from "./rds_queries/queries";
import { selectWeightedRandomActivityGroup } from "./utils";
import { CommunityType } from "../../global_types/CommunityTypes";

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
    context: Context
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

    /*
     * Now then, create the actual post
     */
    const newPost: PostType = {
        id: pid,
        user: user.firstName,
        uid: user.id,
        ranking: user.ranking,
        time: Date.now(),

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
         * Check to be sure user has enough coin
         */
        if (
            userRemainingCoin <
            event.arguments.numUserFollowers * user.postPrice
        ) {
            throw new Error(
                "User doesn't have sufficient coin to complete the transaction"
            );
        } else {
            userRemainingCoin -= user.followers * user.postPrice;
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
             * Also grab the number of users to whom we still need to
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
    }
}
