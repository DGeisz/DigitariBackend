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
import { slightlyRandomTime } from "../utils/time_utils";

const FLW = "flw";

const bronzeCount = 1;
const silverCount = 10;
const goldCount = 100;
const supremeCount = 1000;

const bronzeCoin = 250;
const silverCoin = 1000;
const goldCoin = 10000;
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
    let totalCoin = 0;

    /*
     * Handle bronze
     */
    if (user.following >= bronzeCount && user.followingChallengeIndex < 1) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: bronzeCoin,
            message:
                'You completed the challenge: "Follow one user or community"',
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 1;
        challengeReceipts.push([FLW, bronzeCount].join(":"));
        totalCoin += bronzeCoin;
    }

    /*
     * Handle silver
     */
    if (user.following >= silverCount && user.followingChallengeIndex < 2) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
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
        totalCoin += silverCoin;
    }

    /*
     * Handle gold
     */
    if (user.following >= goldCount && user.followingChallengeIndex < 3) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
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
        totalCoin += goldCoin;
    }

    /*
     * Handle supreme
     */
    if (user.following >= supremeCount && user.followingChallengeIndex < 4) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
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
        totalCoin += supremeCoin;
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
                UpdateExpression: `set followingChallengeIndex = :ni,
                                       newTransactionUpdate = :b,
                                       transTotal = transTotal + :coin,
                                       #cr = list_append(#cr, :cr)`,
                ExpressionAttributeValues: {
                    ":ni": newIndex,
                    ":cr": challengeReceipts,
                    ":b": true,
                    ":coin": totalCoin,
                },
                ExpressionAttributeNames: {
                    "#cr": "challengeReceipts",
                },
            })
            .promise();
    }
}
