import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import {
    EarningsReceipt,
    TransactionType,
} from "../../global_types/TransactionTypes";
import { millisInDay } from "../../utils/time_utils";
import { UserType } from "../../global_types/UserTypes";
import {
    DIGITARI_TRANSACTIONS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { DocumentClient } from "aws-sdk/lib/dynamodb/document_client";
import Key = DocumentClient.Key;
import { ranking2Wage } from "../../global_types/TierTypes";

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<any>
): Promise<EarningsReceipt> {
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const time = Date.now();

    const yesterday = time - millisInDay;

    /*
     * Grab the user
     */
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

    /*
     * If last collection time is NaN, we're in a pickle.
     *
     * The way out of the pickle is thus: first we update lastCollectionTime
     * on user to right frikin now, and we throw a big ol error
     */
    if (isNaN(user.lastCollectionTime)) {
        await dynamoClient
            .update({
                TableName: DIGITARI_USERS,
                Key: {
                    id: uid,
                },
                UpdateExpression: `set lastCollectionTime = :t`,
                ExpressionAttributeValues: {
                    ":t": time,
                },
            })
            .promise();

        throw new Error("lastCollectionTime was NaN");
    }

    const collectionThreshold = Math.max(yesterday, user.lastCollectionTime);

    if (isNaN(collectionThreshold)) {
        throw new Error(
            "For some twisted reason, lastCollectionTime wasn't NaN, but collection threshold is"
        );
    }

    /*
     * Conduct a set of repeated queries, getting all the user's
     * transactions since the collection threshold
     */
    const transactions: TransactionType[] = [];
    let lastKey: Key | undefined = undefined;

    while (true) {
        const lastQuery = await dynamoClient
            .query({
                TableName: DIGITARI_TRANSACTIONS,
                KeyConditionExpression: "tid = :tid and #t > :thresh",
                ExpressionAttributeValues: {
                    ":tid": uid,
                    ":thresh": collectionThreshold,
                },
                ExpressionAttributeNames: {
                    "#t": "time",
                },
                ExclusiveStartKey: lastKey,
            })
            .promise();

        transactions.push(...(lastQuery.Items as TransactionType[]));

        if (!lastQuery.LastEvaluatedKey) {
            break;
        } else {
            lastKey = lastQuery.LastEvaluatedKey;
        }
    }

    /*
     * Ok, now we should have a list of threshold transactions,
     * so simply add it up, and return the lad
     */
    let transactionTotal = 0;

    for (const transaction of transactions) {
        transactionTotal += transaction.coin;
    }

    /*
     * Ok, now we have the total from the transactions,
     * so let's figure out our tier wage
     */
    const [hourlyWage, dailyWage] = ranking2Wage(user.ranking);

    const tierWage = Math.min(
        Math.floor(
            hourlyWage * ((time - user.lastCollectionTime) / (60 * 60 * 1000)) // millis in hour
        ),
        dailyWage
    );

    let totalEarnings = tierWage + transactionTotal;

    /*
     * Finally, we update the user's last collection time
     * so that...you know... the entire system doesn't come
     * crumbling to its knees.
     *
     * We also actually update the user's coin.  Kinda important I guess
     */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: uid,
            },
            UpdateExpression: `set lastCollectionTime = :lt,
                                   coin = coin + :earnings`,
            ExpressionAttributeValues: {
                ":lt": time,
                ":earnings": totalEarnings,
            },
        })
        .promise();

    return {
        coin: totalEarnings,
        time: time,
    };
}
