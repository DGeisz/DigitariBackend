import { UserType } from "../../../global_types/UserTypes";
import { DynamoDB } from "aws-sdk";
import {
    TransactionType,
    TransactionTypesEnum,
} from "../../../global_types/TransactionTypes";
import { sendPushAndHandleReceipts } from "../../../push_notifications/push";
import { PushNotificationType } from "../../../global_types/PushTypes";
import { DIGITARI_USERS } from "../../../global_types/DynamoTableNames";
import { toCommaRep } from "../../../utils/value_rep_utils";

const CF = "cf";

const bronzeCount = 10;
const silverCount = 100;
const goldCount = 1000;
const supremeCount = 10000;

const bronzeCoin = 1000;
const silverCoin = 10000;
const goldCoin = 100000;
const supremeCoin = 1000000;

export async function communityFollowersHandler(
    uid: string,
    communityFollowers: number,
    dynamoClient: DynamoDB.DocumentClient
) {
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

    if (user.communityFollowersChallengeIndex >= 4) {
        return;
    }

    const time = Date.now();

    const transactions: TransactionType[] = [];
    const challengeReceipts: string[] = [];

    let newIndex = 0;

    /*
     * Handle bronze
     */
    if (
        communityFollowers >= bronzeCount &&
        user.communityFollowersChallengeIndex < 1
    ) {
        transactions.push({
            tid: user.id,
            time,
            coin: bronzeCoin,
            message: `You completed the challenge: "Create a community with ${toCommaRep(
                bronzeCount
            )} followers"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 1;
        challengeReceipts.push([CF, bronzeCount].join(":"));
    }

    /*
     * Handle silver
     */
    if (
        communityFollowers >= silverCount &&
        user.communityFollowersChallengeIndex < 2
    ) {
        transactions.push({
            tid: user.id,
            time,
            coin: silverCoin,
            message: `You completed the challenge: "Create a community with ${toCommaRep(
                silverCount
            )} followers"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 2;
        challengeReceipts.push([CF, silverCount].join(":"));
    }

    /*
     * Handle gold
     */
    if (
        communityFollowers >= goldCount &&
        user.communityFollowersChallengeIndex < 3
    ) {
        transactions.push({
            tid: user.id,
            time,
            coin: goldCoin,
            message: `You completed the challenge: "Create a community with ${toCommaRep(
                goldCount
            )} followers"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 3;
        challengeReceipts.push([CF, goldCount].join(":"));
    }

    /*
     * Handle supreme
     */
    if (
        communityFollowers >= supremeCount &&
        user.communityFollowersChallengeIndex < 4
    ) {
        transactions.push({
            tid: user.id,
            time,
            coin: supremeCoin,
            message: `You completed the challenge: "Create a community with ${toCommaRep(
                supremeCount
            )} followers"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 4;
        challengeReceipts.push([CF, supremeCount].join(":"));
    }

    if (transactions.length > 0) {
        /*
         * Write all the transactions
         */
        await dynamoClient
            .batchWrite({
                RequestItems: {
                    DigitariTransactions: transactions.map((transaction) => ({
                        PutRequest: {
                            Item: transaction,
                        },
                    })),
                },
            })
            .promise();

        /*
         * Send push
         */
        try {
            await sendPushAndHandleReceipts(
                user.id,
                PushNotificationType.ChallengeComplete,
                "",
                "",
                "You completed a challenge!",
                dynamoClient
            );
        } catch (e) {}

        /*
         * Modify user
         */
        await dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: user.id,
                },
                UpdateExpression: `set communityFollowersChallengeIndex = :ni,
                                       #cr = list_append(#cr, :cr)`,
                ExpressionAttributeValues: {
                    ":ni": newIndex,
                    ":cr": challengeReceipts,
                },
                ExpressionAttributeNames: {
                    "#cr": "challengeReceipts",
                },
            })
            .promise();
    }
}