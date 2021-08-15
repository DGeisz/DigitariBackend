import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import {
    DIGITARI_BOLT_TRANSACTIONS,
    DIGITARI_COMMUNITIES,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { EventArgs } from "./lambda_types/event_args";
import { FOLLOW_USER_REWARD, UserType } from "../../global_types/UserTypes";
import { v4 } from "uuid";
import { insertFollowRow } from "../follow_user/rds_queries/queries";
import {
    COMMUNITY_DESCRIPTION_MAX_LEN,
    COMMUNITY_NAME_MAX_LEN,
    CREATE_COMMUNITY_PRICE,
    CREATE_COMMUNITY_REWARD,
} from "../../global_types/CommunityTypes";
import { insertCommunityRow } from "./rds_queries/queries";
import {
    BoltTransactionType,
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { Client } from "@elastic/elasticsearch";

const rdsClient = new RdsClient();

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

    if (user.following >= user.maxFollowing) {
        throw new Error(
            "User can't create community because they are already following the maximum number of people"
        );
    }

    /*
     * Make community id
     */
    const cid = v4();

    const updatePromises: Promise<any>[] = [];

    /*
     * Now actually make the community
     */
    updatePromises.push(
        dynamoClient
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
            .promise()
    );

    /*
     * Add the follower row
     */
    updatePromises.push(
        rdsClient.executeQuery<boolean>(
            insertFollowRow(
                cid,
                uid,
                event.arguments.name,
                `${user.firstName} ${user.lastName}`,
                time,
                1
            )
        )
    );

    /*
     * Add the community to rds for reports
     */
    updatePromises.push(
        rdsClient.executeQuery<boolean>(insertCommunityRow(cid))
    );

    /*
     * Index the community
     */
    updatePromises.push(
        esClient.index({
            index: "search",
            body: {
                id: cid,
                name: event.arguments.name,
                followers: 1,
                entityType: 1,
            },
        })
    );

    /*
     * Increment the source's following field, and decrease the
     * users coin
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set following = following + :unit,
                                       levelsCommsFollowed = levelsCommsFollowed + :unit,
                                       levelCommsCreated = levelCommsCreated + :unit,
                                       newTransactionUpdate = :b,
                                       coin = coin - :price,
                                       boltTransTotal = boltTransTotal + :r,
                                       coinSpent = coinSpent + :price`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":price": CREATE_COMMUNITY_PRICE,
                    ":b": true,
                    ":r": CREATE_COMMUNITY_REWARD,
                },
            })
            .promise()
    );
    /*
     * Create bolt transaction for source
     */
    const boltTransaction: BoltTransactionType = {
        tid: user.id,
        time,
        bolts: FOLLOW_USER_REWARD,
        message: `You created "${event.arguments.name}"`,
        transactionType: TransactionTypesEnum.Community,
        transactionIcon: TransactionIcon.Community,
        data: cid,
        ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
    };

    /*
     * Send off bolt transaction
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_BOLT_TRANSACTIONS,
                Item: boltTransaction,
            })
            .promise()
    );

    await Promise.all(updatePromises);

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
