import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { Client } from "elasticsearch";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import {
    DIGITARI_COMMUNITIES,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { EventArgs } from "./lambda_types/event_args";
import { DigitariPrice } from "../../global_types/DigitariPricesTypes";
import { UserType } from "../../global_types/UserTypes";
import { v4 } from "uuid";
import { insertFollowRow } from "../follow_user/rds_queries/queries";
import {
    COMMUNITY_DESCRIPTION_MAX_LEN,
    COMMUNITY_NAME_MAX_LEN,
    CREATE_COMMUNITY_PRICE,
} from "../../global_types/CommunityTypes";
import { insertCommunityRow } from "./rds_queries/queries";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    host: process.env.ES_DOMAIN,
    connectionClass: require("http-aws-es"),
});

export async function handler(event: AppSyncResolverEvent<EventArgs>) {
    const time = Date.now();
    const uid = (event.identity as AppSyncIdentityCognito).sub;

    if (
        event.arguments.name.length > COMMUNITY_NAME_MAX_LEN ||
        event.arguments.description.length > COMMUNITY_DESCRIPTION_MAX_LEN
    ) {
        throw new Error("New Community name or description is too long");
    }

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

    if (user.coin < CREATE_COMMUNITY_PRICE) {
        throw new Error(
            "User doesn't have sufficient coin to create community"
        );
    }

    /*
     * Make community id
     */
    const cid = v4();

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
            },
        })
        .promise();

    /*
     * Make the following entity
     */
    try {
        /*
         * Add the follower row
         */
        await rdsClient.executeQuery<boolean>(
            insertFollowRow(
                cid,
                uid,
                event.arguments.name,
                `${user.firstName} ${user.lastName}`,
                time,
                1
            )
        );

        /*
         * Add the community to rds for reports
         */
        await rdsClient.executeQuery<boolean>(insertCommunityRow(cid));
    } catch (e) {
        throw new Error("RDS error: " + e);
    }

    /*
     * Index the community
     */
    await esClient.index({
        index: "search",
        type: "search_entity",
        id: cid,
        body: {
            id: cid,
            name: event.arguments.name,
            followers: 1,
            entityType: 1,
        },
    });

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
                                       coin = coin - :price,
                                       coinSpent = coinSpent + :price`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":price": CREATE_COMMUNITY_PRICE,
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
