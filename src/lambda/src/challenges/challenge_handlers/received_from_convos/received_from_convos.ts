import { UserType } from "../../../global_types/UserTypes";
import {
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionType,
    TransactionTypesEnum,
} from "../../../global_types/TransactionTypes";
import { DynamoDB } from "aws-sdk";
import { sendPushAndHandleReceipts } from "../../../push_notifications/push";
import { PushNotificationType } from "../../../global_types/PushTypes";
import { DIGITARI_USERS } from "../../../global_types/DynamoTableNames";
import { toCommaRep } from "../../../utils/value_rep_utils";
import { slightlyRandomTime } from "../utils/time_utils";

const RFC = "rfc";

const bronzeCount = 10;
const silverCount = 100;
const goldCount = 1000;
const supremeCount = 10000;

const bronzeCoin = 500;
const silverCoin = 1000;
const goldCoin = 10000;
const supremeCoin = 50000;

export async function receivedFromConvosHandler(
    user: UserType,
    dynamoClient: DynamoDB.DocumentClient
) {
    if (user.rfcChallengeIndex >= 4) {
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
    if (user.receivedFromConvos >= bronzeCount && user.rfcChallengeIndex < 1) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: bronzeCoin,
            message: `You completed the challenge: "Earn ${toCommaRep(
                bronzeCount
            )} digicoin from your posts"`,
            transactionType: TransactionTypesEnum.LevelUp,
            transactionIcon: TransactionIcon.LevelUp,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 1;
        challengeReceipts.push([RFC, bronzeCount].join(":"));
        totalCoin += bronzeCoin;
    }

    /*
     * Handle silver
     */
    if (user.receivedFromConvos >= silverCount && user.rfcChallengeIndex < 2) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: silverCoin,
            message: `You completed the challenge: "Earn ${toCommaRep(
                silverCount
            )} digicoin from your posts"`,
            transactionType: TransactionTypesEnum.LevelUp,
            transactionIcon: TransactionIcon.LevelUp,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 2;
        challengeReceipts.push([RFC, silverCount].join(":"));
        totalCoin += silverCoin;
    }

    /*
     * Handle gold
     */
    if (user.receivedFromConvos >= goldCount && user.rfcChallengeIndex < 3) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: goldCoin,
            message: `You completed the challenge: "Earn ${toCommaRep(
                goldCount
            )} digicoin from your posts"`,
            transactionType: TransactionTypesEnum.LevelUp,
            transactionIcon: TransactionIcon.LevelUp,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 3;
        challengeReceipts.push([RFC, goldCount].join(":"));
        totalCoin += goldCoin;
    }

    /*
     * Handle supreme
     */
    if (user.receivedFromConvos >= supremeCount && user.rfcChallengeIndex < 4) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: supremeCoin,
            message: `You completed the challenge: "Earn ${toCommaRep(
                supremeCount
            )} digicoin from your posts"`,
            transactionType: TransactionTypesEnum.LevelUp,
            transactionIcon: TransactionIcon.LevelUp,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 4;
        challengeReceipts.push([RFC, supremeCount].join(":"));
        totalCoin += goldCoin;
    }

    if (transactions.length > 0) {
        const promises: Promise<any>[] = [];

        /*
         * Write all the transactions
         */
        promises.push(
            dynamoClient
                .batchWrite({
                    RequestItems: {
                        DigitariTransactions: transactions.map(
                            (transaction) => ({
                                PutRequest: {
                                    Item: transaction,
                                },
                            })
                        ),
                    },
                })
                .promise()
        );

        /*
         * Send push
         */
        promises.push(
            sendPushAndHandleReceipts(
                user.id,
                PushNotificationType.ChallengeComplete,
                "",
                "",
                "You completed a challenge!",
                dynamoClient
            )
        );

        /*
         * Modify user
         */
        promises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_USERS,
                    Key: {
                        id: user.id,
                    },
                    UpdateExpression: `set rfcChallengeIndex = :ni,
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
                .promise()
        );

        await Promise.allSettled(promises);
    }
}
