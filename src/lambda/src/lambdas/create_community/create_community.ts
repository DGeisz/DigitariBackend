import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { Client } from "elasticsearch";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import {
    DIGITARI_COMMUNITIES,
    DIGITARI_PRICES,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { EventArgs } from "./lambda_types/event_args";
import { DigitariPrice } from "../../global_types/DigitariPricesTypes";
import { UserType } from "../../global_types/UserTypes";
import { v4 } from "uuid";
import { insertFollowRow } from "../follow_user/rds_queries/queries";

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
