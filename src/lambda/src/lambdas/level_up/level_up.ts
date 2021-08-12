import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { ExtendedUserType, UserType } from "../../global_types/UserTypes";
import {
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import {
    calculateLevel,
    LevelRewardType,
    levelTasksComplete,
} from "../../global_types/LevelTypes";
import {
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionType,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";
import { toCommaRep } from "../../utils/value_rep_utils";

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

interface LevelRewards {
    coin: number;
    maxFollowers: number;
    maxFollowing: number;
    maxPostRecipients: number;
    invites: number;
}

export async function handler(
    event: AppSyncResolverEvent<any>
): Promise<UserType> {
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const time = Date.now();

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
     * Calculate the next level
     */
    const nextLevel = calculateLevel(user.level + 1);

    /*
     * Check if user has completed all the tasks
     */
    if (!levelTasksComplete(nextLevel, user)) {
        throw new Error("User hasn't completed the level tasks!");
    }

    /*
     * Check if user has enough bolts
     */
    if (user.bolts < nextLevel.cost) {
        throw new Error("User doesn't have enough bolts!");
    }

    /*
     * Ok, we've established that the user is good to go.
     * Accumulate the various rewards for one big update
     */
    const totalRewards: LevelRewards = {
        coin: 0,
        maxFollowers: 0,
        maxFollowing: 0,
        maxPostRecipients: 0,
        invites: 0,
    };

    /*
     * Apply rewards to total rewards, and update the in-memory user
     */
    for (let reward of nextLevel.rewards) {
        switch (reward.reward) {
            case LevelRewardType.Coin:
                totalRewards.coin += reward.quantity;
                user.transTotal += reward.quantity;
                break;

            case LevelRewardType.MaxFollowers:
                totalRewards.maxFollowers += reward.quantity;
                user.maxFollowers += reward.quantity;
                break;

            case LevelRewardType.MaxFollowing:
                totalRewards.maxFollowing += reward.quantity;
                user.maxFollowing += reward.quantity;
                break;

            case LevelRewardType.MaxPostRecipients:
                totalRewards.maxPostRecipients += reward.quantity;
                user.maxPostRecipients += reward.quantity;
                break;

            case LevelRewardType.Invites:
                totalRewards.invites += reward.quantity;
                user.remainingInvites += reward.quantity;
                break;
        }
    }

    const updatePromises: Promise<any>[] = [];

    /*
     * Do massive user update
     */
    updatePromises.push(
        dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set #l = #l + :unit, 
                                   bolts = bolts - :p,
                                   newTransactionUpdate = :b,
                                   transTotal = transTotal + :c,
                                   maxFollowers = maxFollowers + :mfs,
                                   maxFollowing = maxFollowing + :mfg,
                                   maxPostRecipients = maxPostRecipients + :mpr,
                                   remainingInvites = remainingInvites + :i,
                                   
                                   levelUsersFollowed = :z,
                                   levelsCommsFollowed = :z,
                                   levelCoinCollected = :z,
                                   levelPostsCreated = :z,
                                   levelPostBoltsBought = :z,
                                   levelInvitedAndJoined = :z,
                                   levelNewResponses = :z,
                                   levelSuccessfulConvos = :z,
                                   levelCommsCreated = :z,
                                   levelCoinSpentOnPosts = :z,
                                   levelCoinEarnedFromPosts = :z
                                   `,
                ExpressionAttributeValues: {
                    ":unit": 1,
                    ":c": totalRewards.coin,
                    ":mfs": totalRewards.maxFollowers,
                    ":mfg": totalRewards.maxFollowing,
                    ":mpr": totalRewards.maxPostRecipients,
                    ":i": totalRewards.invites,
                    ":p": nextLevel.cost,
                    ":b": true,
                    ":z": 0,
                },
                ExpressionAttributeNames: {
                    "#l": "level",
                },
            })
            .promise()
    );

    /*
     * Create level up transaction
     */
    const transaction: TransactionType = {
        tid: uid,
        time: Date.now(),
        coin: totalRewards.coin,
        message: `You reached level ${toCommaRep(user.level + 1)}`,
        transactionType: TransactionTypesEnum.LevelUp,
        transactionIcon: TransactionIcon.LevelUp,
        data: "",
        ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
    };

    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_TRANSACTIONS,
                Item: transaction,
            })
            .promise()
    );

    user.hid = "";

    /*
     * Return the in-memory user
     */
    return user;
}
