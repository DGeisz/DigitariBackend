import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { Client } from "elasticsearch";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { FollowEventArgs } from "../../global_types/follow_event_args";
import { FollowEntityActivity } from "../../global_types/FollowEntityType";
import {
    DIGITARI_COMMUNITIES,
    DIGITARI_PRICES,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { EventArgs } from "./lambda_types/event_args";
import { DigitariPrice } from "../../global_types/DigitariPricesTypes";
import { UserType } from "../../global_types/UserTypes";
import { ranking2Tier } from "../../utils/tier_utils";
import { v4 } from "uuid";
import { insertFollowRow } from "../follow_user/rds_queries/queries";
import { CommunityType } from "../../global_types/CommunityTypes";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    host:
        "https://search-digitari-actxnhry5uq2ipu3r6skwxcvfe.us-east-2.es.amazonaws.com",
    connectionClass: require("http-aws-es"),
});

export async function handler(event: AppSyncResolverEvent<EventArgs>) {
    const time = Date.now();
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const userPostsReq = 10;
    const activityGrouping = 5;

    /*
     * Get the price of following another user
     */
    const price = ((
        await dynamoClient
            .get({
                TableName: DIGITARI_PRICES,
                Key: {
                    id: "CreateCommunity",
                },
            })
            .promise()
    ).Item as DigitariPrice).price;

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

    if (user.coin < price) {
        throw new Error(
            "User doesn't have sufficient coin to create community"
        );
    }

    const userTier = ranking2Tier(user.ranking);

    /*
     * Make community id
     */
    const cid = v4();

    /*
     * Make posts + std provided by tier
     */
    const postsProvidedByTier = new Array(10).fill(0);
    const stdPostsDesiredByTier = new Array(10).fill(1);

    /*
     * Make posts req 4 ag by tier
     * and ag size by tier
     */
    const postsReq4AgByTier = [];
    const agSizeByTier = [];

    for (let i = 0; i < 10; i++) {
        const tierReq = new Array(10).fill(0);
        const tierSize = new Array(10).fill(0);

        if (i === userTier) {
            tierReq[activityGrouping] = userPostsReq;
            tierSize[activityGrouping] = 1;
        }

        postsReq4AgByTier.push(tierReq);
        agSizeByTier.push(tierSize);
    }

    /*
     * Now actually make the community
     */
    await dynamoClient
        .put({
            TableName: DIGITARI_COMMUNITIES,
            Item: {
                id: cid,
                uid,
                name: event.arguments.name,
                description: event.arguments.description,
                followers: 1,
                timeCreated: time,
                postPrice: 10,
                postsProvidedByTier,
                stdPostsDesiredByTier,
                postsRequestedForActivityGroupingsByTier: postsReq4AgByTier,
                activityGroupingSizeByTier: agSizeByTier,
            },
        })
        .promise();

    /*
     * Make the following entity
     */
    try {
        await rdsClient.executeQuery<boolean>(
            insertFollowRow(
                cid,
                uid,
                event.arguments.name,
                `${user.firstName} ${user.lastName}`,
                time,
                1,
                activityGrouping,
                userTier,
                userPostsReq
            )
        );
    } catch (e) {
        throw new Error("RDS error: " + e);
    }

    /*
     * Index the community
     */
    try {
        await esClient.index({
            index: "search",
            type: "search_entity",
            body: {
                id: cid,
                name: event.arguments.name,
                followers: 1,
                entityType: 1,
            },
        });
    } catch (e) {
        throw new Error("ES Error: " + e);
    }

    /*
     * Increment the source's following field, and decrease the
     * users coin
     */
    try {
        await dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set following = following + :unit,
                                       coin = coin - :price`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":price": price,
                },
            })
            .promise();
    } catch (e) {
        throw new Error("Source update error: " + e);
    }

    /*
     * Return the fields corresponding to the community
     * graphql type
     */
    return {
        id: cid,
        uid,
        name: event.arguments.name,
        amFollowing: true,
        description: event.arguments.description,
        followers: 1,
        timeCreated: time.toString(),
    };
}
