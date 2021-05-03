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

const FLR = "flr";

const bronzeCount = 1;
const silverCount = 10;
const goldCount = 100;
const supremeCount = 1000;

const bronzeCoin = 100;
const silverCoin = 1000;
const goldCoin = 10000;
const supremeCoin = 100000;

export async function followersHandler(
    user: UserType,
    dynamoClient: DynamoDB.DocumentClient
) {
    if (user.followersChallengeIndex >= 4) {
        return;
    }

    const time = Date.now();

    const transactions: TransactionType[] = [];
    const challengeReceipts: string[] = [];

    let newIndex = 0;

    /*
     * Handle bronze
     */
    if (user.followers >= bronzeCount && user.followersChallengeIndex < 1) {
        transactions.push({
            tid: user.id,
            time,
            coin: bronzeCoin,
            message: 'You completed the challenge: "Get one follower"',
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 1;
        challengeReceipts.push([FLR, bronzeCount].join(":"));
    }

    /*
     * Handle silver
     */
    if (user.followers >= silverCount && user.followersChallengeIndex < 2) {
        transactions.push({
            tid: user.id,
            time,
            coin: silverCoin,
            message: `You completed the challenge: "Get ${toCommaRep(
                silverCount
            )} followers"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 2;
        challengeReceipts.push([FLR, silverCount].join(":"));
    }

    /*
     * Handle gold
     */
    if (user.followers >= goldCount && user.followersChallengeIndex < 3) {
        transactions.push({
            tid: user.id,
            time,
            coin: goldCoin,
            message: `You completed the challenge: "Get ${toCommaRep(
                goldCount
            )} followers"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 3;
        challengeReceipts.push([FLR, goldCount].join(":"));
    }

    /*
     * Handle supreme
     */
    if (user.followers >= supremeCount && user.followersChallengeIndex < 4) {
        transactions.push({
            tid: user.id,
            time,
            coin: supremeCoin,
            message: `You completed the challenge: "Get ${toCommaRep(
                supremeCount
            )} followers"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 4;
        challengeReceipts.push([FLR, supremeCount].join(":"));
    }

    if (transactions.length > 0) {
        /*
         * Write all the transactions
         */
        await dynamoClient.batchWrite({
            RequestItems: {
                DigitariTransactions: transactions.map((transaction) => ({
                    PutRequest: {
                        Item: transaction,
                    },
                })),
            },
        });

        /*
         * Send push
         */
        try {
            await sendPushAndHandleReceipts(
                user.id,
                PushNotificationType.ChallengeComplete,
                "",
                "You completed a challenge!",
                "",
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
                UpdateExpression: `set followersChallengeIndex = :ni,
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
