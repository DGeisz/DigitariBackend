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

const SOC = "soc";

const bronzeCount = 10;
const silverCount = 100;
const goldCount = 1000;
const supremeCount = 10000;

const bronzeCoin = 100;
const silverCoin = 1000;
const goldCoin = 10000;
const supremeCoin = 100000;

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

    /*
     * Handle bronze
     */
    if (user.spentOnConvos >= bronzeCount && user.socChallengeIndex < 1) {
        transactions.push({
            tid: user.id,
            time,
            coin: bronzeCoin,
            message: `You completed the challenge: "Spend ${toCommaRep(
                bronzeCount
            )} digicoin on likes or responses"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 1;
        challengeReceipts.push([SOC, bronzeCount].join(":"));
    }

    /*
     * Handle silver
     */
    if (user.spentOnConvos >= silverCount && user.socChallengeIndex < 2) {
        transactions.push({
            tid: user.id,
            time,
            coin: silverCoin,
            message: `You completed the challenge: "Spend ${toCommaRep(
                silverCount
            )} digicoin on likes or responses"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 2;
        challengeReceipts.push([SOC, silverCount].join(":"));
    }

    /*
     * Handle gold
     */
    if (user.spentOnConvos >= goldCount && user.socChallengeIndex < 3) {
        transactions.push({
            tid: user.id,
            time,
            coin: goldCoin,
            message: `You completed the challenge: "Spend ${toCommaRep(
                goldCount
            )} digicoin on likes or responses"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 3;
        challengeReceipts.push([SOC, goldCount].join(":"));
    }

    /*
     * Handle supreme
     */
    if (user.spentOnConvos >= supremeCount && user.socChallengeIndex < 4) {
        transactions.push({
            tid: user.id,
            time,
            coin: supremeCoin,
            message: `You completed the challenge: "Spend ${toCommaRep(
                supremeCount
            )} digicoin on likes or responses"`,
            transactionType: TransactionTypesEnum.Challenge,
            data: "",
            ttl: Math.round(time / 1000) + 24 * 60 * 60, // 24 hours past `time` in epoch seconds
        });

        newIndex = 4;
        challengeReceipts.push([SOC, supremeCount].join(":"));
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
                UpdateExpression: `set socChallengeIndex = :ni,
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
