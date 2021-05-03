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

const FLW = "flw";

const bronzeCount = 1;
const silverCount = 10;
const goldCount = 100;
const supremeCount = 1000;

const bronzeCoin = 100;
const silverCoin = 500;
const goldCoin = 5000;
const supremeCoin = 50000;

export async function followingHandler(
    user: UserType,
    dynamoClient: DynamoDB.DocumentClient
) {
    if (user.followingChallengeIndex >= 4) {
        return;
    }

    const time = Date.now();

    const transactions: TransactionType[] = [];
    const challengeReceipts: string[] = [];

    let newIndex = 0;

    /*
     * Handle bronze
     */
    if (user.following >= bronzeCount && user.followingChallengeIndex < 1) {
        transactions.push({
            tid: user.id,
            time,
            coin: bronzeCoin,
            message:
                'You completed the challenge: "Follow one user or community"',
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 1;
        challengeReceipts.push([FLW, bronzeCount].join(":"));
    }

    /*
     * Handle silver
     */
    if (user.following >= silverCount && user.followingChallengeIndex < 2) {
        transactions.push({
            tid: user.id,
            time,
            coin: silverCoin,
            message: `You completed the challenge: "Follow ${toCommaRep(
                silverCount
            )} users or communities"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 2;
        challengeReceipts.push([FLW, silverCount].join(":"));
    }

    /*
     * Handle gold
     */
    if (user.following >= goldCount && user.followingChallengeIndex < 3) {
        transactions.push({
            tid: user.id,
            time,
            coin: goldCoin,
            message: `You completed the challenge: "Follow ${toCommaRep(
                goldCount
            )} users or communities"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 3;
        challengeReceipts.push([FLW, goldCount].join(":"));
    }

    /*
     * Handle supreme
     */
    if (user.following >= supremeCount && user.followingChallengeIndex < 4) {
        transactions.push({
            tid: user.id,
            time,
            coin: supremeCoin,
            message: `You completed the challenge: "Follow ${toCommaRep(
                supremeCount
            )} users or communities"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 4;
        challengeReceipts.push([FLW, supremeCount].join(":"));
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
                UpdateExpression: `set followingChallengeIndex = :ni,
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
