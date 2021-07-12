import { UserType } from "../../../global_types/UserTypes";
import { DynamoDB } from "aws-sdk";
import {
    TRANSACTION_TTL,
    TransactionType,
    TransactionTypesEnum,
} from "../../../global_types/TransactionTypes";
import { sendPushAndHandleReceipts } from "../../../push_notifications/push";
import { PushNotificationType } from "../../../global_types/PushTypes";
import { DIGITARI_USERS } from "../../../global_types/DynamoTableNames";
import { toCommaRep } from "../../../utils/value_rep_utils";
import { slightlyRandomTime } from "../utils/time_utils";

const SOC = "soc";

const bronzeCount = 20;
const silverCount = 200;
const goldCount = 2000;
const supremeCount = 20000;

const bronzeCoin = 250;
const silverCoin = 500;
const goldCoin = 5000;
const supremeCoin = 20000;

export async function spentOnConvosHandler(
    user: UserType,
    dynamoClient: DynamoDB.DocumentClient
) {
    if (user.socChallengeIndex >= 4) {
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
    if (user.spentOnConvos >= bronzeCount && user.socChallengeIndex < 1) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: bronzeCoin,
            message: `You completed the challenge: "Spend ${toCommaRep(
                bronzeCount
            )} digicoin on digibolts"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 1;
        challengeReceipts.push([SOC, bronzeCount].join(":"));
        totalCoin += bronzeCoin;
    }

    /*
     * Handle silver
     */
    if (user.spentOnConvos >= silverCount && user.socChallengeIndex < 2) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: silverCoin,
            message: `You completed the challenge: "Spend ${toCommaRep(
                silverCount
            )} digicoin on digibolts"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 2;
        challengeReceipts.push([SOC, silverCount].join(":"));
        totalCoin += silverCoin;
    }

    /*
     * Handle gold
     */
    if (user.spentOnConvos >= goldCount && user.socChallengeIndex < 3) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: goldCoin,
            message: `You completed the challenge: "Spend ${toCommaRep(
                goldCount
            )} digicoin on digibolts"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 3;
        challengeReceipts.push([SOC, goldCount].join(":"));
        totalCoin += goldCoin;
    }

    /*
     * Handle supreme
     */
    if (user.spentOnConvos >= supremeCount && user.socChallengeIndex < 4) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: supremeCoin,
            message: `You completed the challenge: "Spend ${toCommaRep(
                supremeCount
            )} digicoin on digibolts"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 4;
        challengeReceipts.push([SOC, supremeCount].join(":"));
        totalCoin += supremeCoin;
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
                    UpdateExpression: `set socChallengeIndex = :ni,
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
