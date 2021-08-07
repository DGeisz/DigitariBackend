import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import {
    BioFonts,
    ExtendedUserType,
    NameFonts,
    ProfileColors,
    ProfileStickers,
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
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { sendPushAndHandleReceipts } from "../../push_notifications/push";
import { PushNotificationType } from "../../global_types/PushTypes";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { Client } from "elasticsearch";
import { toCommaRep } from "../../utils/value_rep_utils";
import { filterEmoji } from "../../utils/string_utils";
import { insertFollowRow } from "../follow_user/rds_queries/queries";
import { millisInDay } from "../../utils/time_utils";

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

    let { code, firstName, lastName, email } = event.arguments;

    firstName = filterEmoji(firstName);
    lastName = filterEmoji(lastName);

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

    const invitingUser: UserType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: invite.uid,
                },
            })
            .promise()
    ).Item as ExtendedUserType;

    const inviterExists =
        !!invitingUser && !!invitingUser.firstName && !!invitingUser.lastName;

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

        maxWallet: 100,
        walletBonusEnd: time + 2 * millisInDay,

        nameFont: NameFonts.Default,
        nameFontsPurchased: [NameFonts.Default],
        nameColor: ProfileColors.Default,
        nameColorsPurchased: [ProfileColors.Default],
        bioFont: BioFonts.Default,
        bioFontsPurchased: [BioFonts.Default],
        bioColor: ProfileColors.Default,
        bioColorsPurchased: [ProfileColors.Default],
        profileSticker: ProfileStickers.Default,
        profileStickersPurchased: [ProfileStickers.Default],

        lastCollectionTime: 0,

        lastFeedTime: 0,
        feedPendingCollection: false,
        lastPostsTime: 0,
        postsPendingCollection: false,
        transTotal: 1000,

        newConvoUpdate: false,
        newTransactionUpdate: true,

        challengeReceipts: [],

        coinSpent: 0,

        receivedFromConvos: 0,
        spentOnConvos: 0,

        successfulConvos: 0,

        postCount: 0,

        maxFollowers: 1,
        followers: 0,

        maxFollowing: 2,
        following: inviterExists ? 1 : 0,

        maxPostRecipients: 0,

        // Level fields
        level: 0,
        levelUsersFollowed: 0,
        levelsCommsFollowed: 0,
        levelCoinCollected: 0,
        levelPostsCreated: 0,
        levelPostBoltsBought: 0,
        levelInvitedAndJoined: 0,
        levelNewResponses: 0,
        levelSuccessfulConvos: 0,
        levelCommsCreated: 0,
        levelCoinSpentOnPosts: 0,
        levelCoinEarnedFromPosts: 0,
    };

    const updatePromises: Promise<any>[] = [];
    const finalPromises: Promise<any>[] = [];

    /*
     * Alright, now that we have the user in memory, let's
     * create the bad boi
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_USERS,
                Item: newUser,
            })
            .promise()
    );

    /*
     * Add the "You joined digitari!" Transaction
     */
    const joinTransaction: TransactionType = {
        tid: uid,
        time,
        coin: 1000,
        message: "You joined Digitari!",
        transactionType: TransactionTypesEnum.User,
        transactionIcon: TransactionIcon.User,
        data: uid,
        ttl: Math.round(time / 1000) + TRANSACTION_TTL,
    };

    /*
     * Send off the transaction
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_TRANSACTIONS,
                Item: joinTransaction,
            })
            .promise()
    );

    /*
     * Now add the user's rds row
     */
    updatePromises.push(
        rdsClient.executeSql(`INSERT INTO users VALUES ('${uid}', 0)`)
    );

    /*
     * Now let's index this user in elastic search
     */
    updatePromises.push(
        esClient.index({
            index: "search",
            type: "search_entity",
            id: uid,
            body: {
                id: uid,
                name: `${firstName} ${lastName}`,
                followers: 0,
                entityType: 0,
            },
        })
    );

    if (inviterExists) {
        /*
         * Let's automatically follow the inviting user,
         * and increase that user's followers everywhere
         */
        updatePromises.push(
            rdsClient.executeQuery<boolean>(
                insertFollowRow(
                    invitingUser.id,
                    uid,
                    `${invitingUser.firstName} ${invitingUser.lastName}`,
                    `${firstName} ${lastName}`,
                    time,
                    0
                )
            )
        );

        updatePromises.push(
            esClient.updateByQuery({
                index: "search",
                type: "search_entity",
                body: {
                    query: {
                        match: {
                            id: invitingUser.id,
                        },
                    },
                    script: {
                        source: "ctx._source.followers += 1",
                        lang: "painless",
                    },
                },
            })
        );

        /*
         * Ok, now let's reward the person who gave the invite
         */
        updatePromises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_USERS,
                    Key: {
                        id: invite.uid,
                    },
                    UpdateExpression: `set newTransactionUpdate = :b,
                                       followers = followers + :unit,
                                       transTotal = transTotal + :reward`,
                    ExpressionAttributeValues: {
                        ":b": true,
                        ":reward": INVITE_REWARD,
                        ":unit": 1,
                    },
                })
                .promise()
        );

        const inviteTransaction: TransactionType = {
            tid: invite.uid,
            time,
            coin: INVITE_REWARD,
            message: `${firstName} joined Digitari!`,
            transactionType: TransactionTypesEnum.User,
            transactionIcon: TransactionIcon.User,
            data: uid,
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        };

        /*
         * Send off the transaction
         */
        updatePromises.push(
            dynamoClient
                .put({
                    TableName: DIGITARI_TRANSACTIONS,
                    Item: inviteTransaction,
                })
                .promise()
        );
    }

    /*
     * Let's check if the invite is a super invite
     * code
     */
    if (!!invite.count) {
        /*
         * This means the count is >1, so decrement
         * the count
         */
        updatePromises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_INVITES,
                    Key: {
                        code,
                    },
                    UpdateExpression: `set #c = #c - :unit`,
                    ExpressionAttributeValues: {
                        ":unit": 1,
                    },
                    ExpressionAttributeNames: {
                        "#c": "count",
                    },
                })
                .promise()
        );
    } else {
        /*
         * Otherwise, just delete the invite
         */
        updatePromises.push(
            dynamoClient
                .delete({
                    TableName: DIGITARI_INVITES,
                    Key: {
                        code,
                    },
                })
                .promise()
        );
    }

    finalPromises.push(Promise.all(updatePromises));

    finalPromises.push(
        sendPushAndHandleReceipts(
            invite.uid,
            PushNotificationType.UserJoined,
            uid,
            "",
            `${firstName} joined Digitari! (+${toCommaRep(
                INVITE_REWARD
            )} Digicoin)`,
            dynamoClient
        )
    );

    const finalResolution = await Promise.allSettled(finalPromises);

    if (finalResolution[0].status === "rejected") {
        throw new Error(finalResolution[0].reason);
        // throw new Error("Ran into an error creating the user");
    }

    return newUser;
}
