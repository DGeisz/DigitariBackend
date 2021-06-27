import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import {
    ExtendedUserType,
    NameStickers,
    ProfileColors,
    ProfileFonts,
    UserType,
} from "../../global_types/UserTypes";
import { EventArgs } from "./lambda_types/event_args";
import { v4 } from "uuid";
import {
    DIGITARI_INVITES,
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { InviteType } from "../../global_types/InviteTypes";
import {
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { Client } from "elasticsearch";
import { toCommaRep } from "../../utils/value_rep_utils";

const INVITE_REWARD = 500;

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    host: process.env.ES_DOMAIN,
    connectionClass: require("http-aws-es"),
});

export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<UserType> {
    const time = Date.now();
    const uid = (event.identity as AppSyncIdentityCognito).sub;

    const { code, firstName, lastName, email } = event.arguments;

    /*
     * Alright before we go crazy, let's see if this user already
     * exists
     */
    const user: ExtendedUserType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
            })
            .promise()
    ).Item as ExtendedUserType;

    /*
     * The extra fields are to prevent the
     * bug where the user isn't fully created
     */
    if (!!user && !!user.firstName && !!user.lastName && !!user.email) {
        return user;
    }

    /*
     * Ok, so at this point we've verified that the user
     * doesn't exist, now let's be sure that the invite
     *  code the user is using exists
     */
    const invite: InviteType | null = (
        await dynamoClient
            .get({
                TableName: DIGITARI_INVITES,
                Key: {
                    code,
                },
            })
            .promise()
    ).Item as InviteType | null;

    if (!invite) {
        throw new Error("The invite code you provided isn't valid");
    }

    /*
     * Ok, so at this point, let's go ahead and forge this bad boi
     */
    const newUser: ExtendedUserType = {
        id: uid,
        hid: v4(),
        firstName,
        lastName,
        email,
        remainingInvites: 30,

        timeCreated: time,
        lastCheckIn: time,

        amFollowing: false,

        bio: "",
        link: "",
        ranking: 0,
        blocked: 0,
        beenBlocked: 0,
        coin: 100,
        bolts: 0,

        nameFont: ProfileFonts.Default,
        nameColor: ProfileColors.Default,
        bioFont: ProfileFonts.Default,
        bioColor: ProfileColors.Default,
        nameSticker: NameStickers.Default,

        lastCollectionTime: 0,

        lastFeedTime: 0,
        feedPendingCollection: false,
        lastPostsTime: 0,
        postsPendingCollection: false,
        transTotal: 0,

        newConvoUpdate: false,
        newTransactionUpdate: false,

        challengeReceipts: [],

        coinSpent: 0,

        receivedFromConvos: 0,
        rfcChallengeIndex: 0,

        spentOnConvos: 0,
        socChallengeIndex: 0,

        successfulConvos: 0,
        scChallengeIndex: 0,

        postCount: 0,
        pcChallengeIndex: 0,

        followers: 0,
        followersChallengeIndex: 0,

        following: 0,
        followingChallengeIndex: 0,

        communityFollowersChallengeIndex: 0,
        maxCommunityFollowers: 0,
    };

    /*
     * Alright, now that we have the user in memory, let's
     * create the bad boi
     */
    await dynamoClient
        .put({
            TableName: DIGITARI_USERS,
            Item: newUser,
        })
        .promise();

    /*
     * Now add the user's rds row
     */
    await rdsClient.executeSql(`INSERT INTO users VALUES ('${uid}', 0)`);

    /*
     * Now let's index this user in elastic search
     */
    await esClient.index({
        index: "search",
        type: "search_entity",
        id: uid,
        body: {
            id: uid,
            name: `${firstName} ${lastName}`,
            followers: 0,
            entityType: 0,
        },
    });

    /*
     * Ok, now let's reward the person who gave the invite
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: invite.uid,
            },
            UpdateExpression: `set newTransactionUpdate = :b,
                                   transTotal = transTotal + :reward`,
            ExpressionAttributeValues: {
                ":b": true,
                ":reward": INVITE_REWARD,
            },
        })
        .promise();

    const transaction: TransactionType = {
        tid: invite.uid,
        time,
        coin: INVITE_REWARD,
        message: `${firstName} joined Digitari!`,
        transactionType: TransactionTypesEnum.User,
        data: uid,
        ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
    };

    /*
     * Send off the transaction
     */
    await dynamoClient
        .put({
            TableName: DIGITARI_TRANSACTIONS,
            Item: transaction,
        })
        .promise();

    /*
     * Let's check if the invite is a super invite
     * code
     */
    if (!!invite.count) {
        /*
         * This means the count is >1, so decrement
         * the count
         */
        await dynamoClient
            .update({
                TableName: DIGITARI_INVITES,
                Key: {
                    code,
                },
                UpdateExpression: `set count = count - :unit`,
                ExpressionAttributeValues: {
                    ":unit": 1,
                },
            })
            .promise();
    } else {
        /*
         * Otherwise, just delete the invite
         */
        await dynamoClient
            .delete({
                TableName: DIGITARI_INVITES,
                Key: {
                    code,
                },
            })
            .promise();
    }

    try {
        await sendPushAndHandleReceipts(
            invite.uid,
            PushNotificationType.UserJoined,
            uid,
            "",
            `${firstName} joined Digitari! (+${toCommaRep(
                INVITE_REWARD
            )} Digicoin)`,
            dynamoClient
        );
    } catch (e) {}

    return newUser;
}
