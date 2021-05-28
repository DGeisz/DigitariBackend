import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import { EventArgs } from "./lambda_types/event_args";
import * as IAP from "in-app-purchase";
import { ReceiptType } from "../../global_types/ReceiptTypes";
import {
    DIGITARI_RECEIPTS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { products } from "./lambda_types/coin_types";

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

IAP.config({
    /* Config for apple */
    appleExcludeOldTransactions: true,
    applePassword: process.env.APPLE_SECRET,

    /* Config for google */
    googleServiceAccount: {
        clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
        privateKey: process.env.GOOGLE_PRIVATE_KEY,
    },
});

/* 
Lambda resolver that processes iap purchase receipts,
and if the receipts are acceptable, fulfills the transactions
by giving the proper amount of coin to each account.

The resolver returns `true` if the transactions was successfully fulfilled,
and `false` if something went wrong
 */
export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<boolean> {
    const uid = (event.identity as AppSyncIdentityCognito).sub;

    const { productId, receipt, ios } = event.arguments;

    /* Init the verification module */
    await IAP.setup();

    let receiptId: string;

    /* First things first, let's verify the receipt, cause that's free */
    try {
        /* We use a slightly different receipt for ios vs android */
        if (ios) {
            const data: any = await IAP.validate(receipt);

            receiptId = data.receipt.in_app[0].transaction_id;
        } else {
            await IAP.validate({
                packageName: "com.playdigitari.digitari",
                productId,
                purchaseToken: receipt,
                subscription: false,
            });

            receiptId = receipt;
        }
    } catch (e) {
        /* 
        If it throws an error, then the receipt isn't valid 
        so we can immediately return false, indicating the iap
        wasn't processed
        */
        return false;
    }

    /* 
    Ok, so now we've established the receipt is valid.
    Now we have to see if this receipt has been processed before
    */
    const storedReceipt: ReceiptType | null = (
        await dynamoClient
            .get({
                TableName: DIGITARI_RECEIPTS,
                Key: {
                    receipt: receiptId,
                },
            })
            .promise()
    ).Item as ReceiptType | null;

    /* 
    If the receipt exists, then we've already processed
    the receipt, which means something sketchy is the foot,
    so we return false and don't process this bad boi
    */
    if (!!storedReceipt) {
        return false;
    }

    /* 
    Ok, now we actually give the user the coin
    they so desperately want
    */
    await dynamoClient
        .update({
            TableName: DIGITARI_USERS,
            Key: {
                id: uid,
            },
            UpdateExpression: `set coin = coin + :amount`,
            ExpressionAttributeValues: {
                ":amount": products[productId],
            },
        })
        .promise();

    /* 
    Now we store the receipt, to, you know,
    prevent fraud
    */
    await dynamoClient
        .put({
            TableName: DIGITARI_RECEIPTS,
            Item: {
                receipt: receiptId,
                uid,
            },
        })
        .promise();

    return true;
}
