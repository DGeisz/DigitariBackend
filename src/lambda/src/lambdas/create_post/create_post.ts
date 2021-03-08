import { DynamoDB, RDSDataService } from "aws-sdk";
import {
    AppSyncIdentityCognito,
    AppSyncResolverEvent,
    Context,
} from "aws-lambda";
import { v4 } from "uuid";
import { EventArgs } from "./lambda_types/event_type";
import { UserType } from "../../global_types/UserTypes";
import { PostType } from "../../global_types/PostTypes";

/*
 * Initialize the clients we use to access our services
 */
const rdsDataService = new RDSDataService();

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
    /*
     * Fetch the user doing the posting
     */
    const user: UserType = (
        await dynamoClient
            .get({
                TableName: "DigitariUsers",
                Key: {
                    id: (event.identity as AppSyncIdentityCognito).sub,
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
     * Use this to keep track if the user has enough coin
     * to complete the transaction
     */
    let userRemainingCoin = user.coin;

    /*
     * Distribute the post.  First, we distribute the post
     * to the user's followers, if that's desired
     */
    if (event.arguments.post2Followers) {
        /*
         * First check to see if we're distributing to all followers
         *
         * In the case where the user tries to post to more followers than
         * they have, we just decrease the count to the number of followers
         * they do have
         */
        if (event.arguments.numUserFollowers >= user.followers) {
            /*
             * Check to be sure user has enough coin
             */
            if (userRemainingCoin < user.followers * user.postPrice) {
                throw new Error(
                    "User doesn't have sufficient coin to complete the transaction"
                );
            } else {
                userRemainingCoin -= user.followers * user.postPrice;
            }
        } else {
        }
    }

    // return await rdsDataService
    //     .executeStatement({
    //         secretArn: process.env.SECRET_ARN,
    //         resourceArn: process.env.CLUSTER_ARN,
    //         sql: "select * from test_rds",
    //         database: process.env.DATABASE,
    //         includeResultMetadata: true,
    //     })
    //     .promise();
}
