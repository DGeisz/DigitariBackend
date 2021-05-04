import { UserType } from "../../../global_types/UserTypes";
import {
    TransactionType,
    TransactionTypesEnum,
} from "../../../global_types/TransactionTypes";
import { DynamoDB } from "aws-sdk";
import { sendPushAndHandleReceipts } from "../../../push_notifications/push";
import { PushNotificationType } from "../../../global_types/PushTypes";
import { DIGITARI_USERS } from "../../../global_types/DynamoTableNames";
import { toCommaRep } from "../../../utils/value_rep_utils";

const PC = "pc";

const bronzeCount = 1;
const silverCount = 10;
const goldCount = 100;
const supremeCount = 1000;

const bronzeCoin = 100;
const silverCoin = 1000;
const goldCoin = 10000;
const supremeCoin = 100000;

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

    /*
     * Handle bronze
     */
    if (user.postCount >= bronzeCount && user.pcChallengeIndex < 1) {
        transactions.push({
            tid: user.id,
            time,
            coin: bronzeCoin,
            message: `You completed the challenge: "Create a post"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 1;
        challengeReceipts.push([PC, bronzeCount].join(":"));
    }

    /*
     * Handle silver
     */
    if (user.postCount >= silverCount && user.pcChallengeIndex < 2) {
        transactions.push({
            tid: user.id,
            time,
            coin: silverCoin,
            message: `You completed the challenge: "Create ${toCommaRep(
                silverCount
            )} posts"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 2;
        challengeReceipts.push([PC, silverCount].join(":"));
    }

    /*
     * Handle gold
     */
    if (user.postCount >= goldCount && user.pcChallengeIndex < 3) {
        transactions.push({
            tid: user.id,
            time,
            coin: goldCoin,
            message: `You completed the challenge: "Create ${toCommaRep(
                goldCount
            )} posts"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 3;
        challengeReceipts.push([PC, goldCount].join(":"));
    }

    /*
     * Handle supreme
     */
    if (user.postCount >= supremeCount && user.pcChallengeIndex < 4) {
        transactions.push({
            tid: user.id,
            time,
            coin: supremeCoin,
            message: `You completed the challenge: "Create ${toCommaRep(
                supremeCount
            )} posts"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 4;
        challengeReceipts.push([PC, supremeCount].join(":"));
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
         * Modify user
         */
        await dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: user.id,
                },
                UpdateExpression: `set pcChallengeIndex = :ni,
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
