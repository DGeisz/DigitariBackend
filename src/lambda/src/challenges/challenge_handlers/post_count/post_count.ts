import { UserType } from "../../../global_types/UserTypes";
import {
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionType,
    TransactionTypesEnum,
} from "../../../global_types/TransactionTypes";
import { DynamoDB } from "aws-sdk";
import { DIGITARI_USERS } from "../../../global_types/DynamoTableNames";
import { toCommaRep } from "../../../utils/value_rep_utils";
import { slightlyRandomTime } from "../utils/time_utils";

const PC = "pc";

const bronzeCount = 1;
const silverCount = 10;
const goldCount = 100;
const supremeCount = 1000;

const bronzeCoin = 250;
const silverCoin = 500;
const goldCoin = 5000;
const supremeCoin = 10000;

export async function postCountHandler(
    user: UserType,
    dynamoClient: DynamoDB.DocumentClient
) {
    if (user.pcChallengeIndex >= 4) {
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
    if (user.postCount >= bronzeCount && user.pcChallengeIndex < 1) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: bronzeCoin,
            message: `You completed the challenge: "Create a post"`,
            transactionType: TransactionTypesEnum.LevelUp,
            transactionIcon: TransactionIcon.LevelUp,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 1;
        challengeReceipts.push([PC, bronzeCount].join(":"));
        totalCoin += bronzeCoin;
    }

    /*
     * Handle silver
     */
    if (user.postCount >= silverCount && user.pcChallengeIndex < 2) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: silverCoin,
            message: `You completed the challenge: "Create ${toCommaRep(
                silverCount
            )} posts"`,
            transactionType: TransactionTypesEnum.LevelUp,
            transactionIcon: TransactionIcon.LevelUp,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 2;
        challengeReceipts.push([PC, silverCount].join(":"));
        totalCoin += silverCoin;
    }

    /*
     * Handle gold
     */
    if (user.postCount >= goldCount && user.pcChallengeIndex < 3) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: goldCoin,
            message: `You completed the challenge: "Create ${toCommaRep(
                goldCount
            )} posts"`,
            transactionType: TransactionTypesEnum.LevelUp,
            transactionIcon: TransactionIcon.LevelUp,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 3;
        challengeReceipts.push([PC, goldCount].join(":"));
        totalCoin += goldCoin;
    }

    /*
     * Handle supreme
     */
    if (user.postCount >= supremeCount && user.pcChallengeIndex < 4) {
        transactions.push({
            tid: user.id,
            time: slightlyRandomTime(),
            coin: supremeCoin,
            message: `You completed the challenge: "Create ${toCommaRep(
                supremeCount
            )} posts"`,
            transactionType: TransactionTypesEnum.LevelUp,
            transactionIcon: TransactionIcon.LevelUp,
            data: "",
            ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
        });

        newIndex = 4;
        challengeReceipts.push([PC, supremeCount].join(":"));
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
         * Modify user
         */
        promises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_USERS,
                    Key: {
                        id: user.id,
                    },
                    UpdateExpression: `set pcChallengeIndex = :ni,
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
