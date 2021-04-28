import { Expo, ExpoPushReceipt } from "expo-server-sdk";
import { DynamoDB } from "aws-sdk";
import {
    PushNotificationType,
    PushTicket,
    UserToken,
} from "../global_types/PushTypes";
import {
    DIGITARI_PUSH,
    DIGITARI_PUSH_TICKETS,
} from "../global_types/DynamoTableNames";

const MAX_BATCH_WRITE_ITEMS = 20;

const expo = new Expo();

export async function sendPushAndHandleReceipts(
    tid: string,
    notificationType: PushNotificationType,
    content: string,
    title: string,
    body: string,
    dynamoClient: DynamoDB.DocumentClient
) {
    /*
     * Get epoch time in seconds
     */
    const time = Math.round(Date.now() / 1000);

    /*
     * First, get all the tokens associated with this user
     */
    const userTokens: UserToken[] = (
        await dynamoClient
            .query({
                KeyConditionExpression: "uid = :uid",
                ExpressionAttributeValues: {
                    ":uid": tid,
                },
                TableName: DIGITARI_PUSH,
            })
            .promise()
    ).Items as UserToken[];

    const successfulTickets: PushTicket[] = [];

    /*
     * Now, for each token associated with this user,
     * we need to see if there are any push receipts
     * we need to resolve for the token.
     *
     * If everything is good, then we add an entry to
     * the list of push notifications for this user
     */
    for (const token of userTokens) {
        let finalBackOffTime = token.backOffTime + token.backOffInterval;
        let deleteToken: boolean = false;
        let rateLimitToken: boolean = false;
        let allowMessage = true;

        if (time < finalBackOffTime) {
            /*
             * We're not allowed to send this message before
             * the finalBackOffTime
             */
            allowMessage = false;
        }

        try {
            const tokenTickets: PushTicket[] = (
                await dynamoClient
                    .query({
                        KeyConditionExpression: "id = :id",
                        ExpressionAttributeValues: {
                            ":id": token.token,
                        },
                        TableName: DIGITARI_PUSH_TICKETS,
                        ScanIndexForward: false,
                    })
                    .promise()
            ).Items as PushTicket[];

            if (tokenTickets.length > 0) {
                const ticketIds = tokenTickets.map((ticket) => ticket.id);

                const receiptIdChunks = expo.chunkPushNotificationReceiptIds(
                    ticketIds
                );

                const processedReceipts: string[] = [];

                for (let chunk of receiptIdChunks) {
                    try {
                        let receipts = await expo.getPushNotificationReceiptsAsync(
                            chunk
                        );

                        processedReceipts.push(...Object.keys(receipts));

                        for (const receiptId in receipts) {
                            const receipt: ExpoPushReceipt =
                                receipts[receiptId];

                            if (
                                receipt.status === "error" &&
                                !!receipt?.details &&
                                !!receipt.details?.error
                            ) {
                                if (
                                    receipt.details.error ===
                                    "DeviceNotRegistered"
                                ) {
                                    deleteToken = true;
                                } else if (
                                    receipt.details.error ===
                                    "MessageRateExceeded"
                                ) {
                                    /*
                                     * Now get the full token object to which this corresponds
                                     */
                                    const fullTicket = tokenTickets.find(
                                        (ticket) => ticket.id === receiptId
                                    );

                                    if (!!fullTicket) {
                                        /*
                                         * If this token was stored after the last back off time
                                         * then we need to do a harder rate limit on this token,
                                         * so
                                         */
                                        if (
                                            fullTicket.time > finalBackOffTime
                                        ) {
                                            finalBackOffTime = fullTicket.time;
                                            rateLimitToken = true;
                                            allowMessage = false;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // throw new Error("Can't get receipts");
                    }
                }

                /*
                 * Now we delete all the tickets that were processed during this request
                 */
                const processedTickets = tokenTickets.filter((ticket) =>
                    processedReceipts.includes(ticket.ticket)
                );

                for (
                    let i = 0;
                    i < processedTickets.length;
                    i += MAX_BATCH_WRITE_ITEMS
                ) {
                    const writeRequests = [];

                    for (let k = 0; k < MAX_BATCH_WRITE_ITEMS; ++k) {
                        /*
                         * First check that we haven't reached the end
                         * of successful tickets
                         */
                        if (i + k >= processedTickets.length) {
                            break;
                        } else {
                            /*
                             * Otherwise, add a record to
                             * the list of write records
                             */
                            writeRequests.push({
                                DeleteRequest: {
                                    Key: {
                                        id: token.token,
                                        time: processedTickets[i + k].time,
                                    },
                                },
                            });
                        }
                    }

                    if (writeRequests.length > 0) {
                        await dynamoClient
                            .batchWrite({
                                RequestItems: {
                                    DigitariPushTickets: writeRequests,
                                },
                            })
                            .promise();
                    }
                }
            }

            if (deleteToken) {
                /*
                 * If we need to delete the token, just
                 * get it over with
                 */
                await dynamoClient
                    .delete({
                        TableName: DIGITARI_PUSH,
                        Key: {
                            uid: tid,
                            token: token.token,
                        },
                    })
                    .promise();
            } else {
                /*
                 * If we need to further rate limit the token, do it here
                 */
                if (rateLimitToken) {
                    const interval =
                        token.backOffInterval === 0
                            ? 30
                            : 2 * token.backOffInterval;

                    await dynamoClient
                        .update({
                            TableName: DIGITARI_PUSH,
                            Key: {
                                uid: tid,
                                token: token.token,
                            },
                            UpdateExpression:
                                "set backOffInterval = :bi, backOffTime = :bt",
                            ExpressionAttributeValues: {
                                ":bi": interval,
                                ":bt": finalBackOffTime,
                            },
                        })
                        .promise();
                } else if (allowMessage) {
                    /*
                     * If the back off interval was greater than zero,
                     * then we there was some rate limiting in place.
                     *
                     * Because all the tickets cleared, we can now
                     * get rid of the rate limiting
                     */
                    if (token.backOffInterval > 0) {
                        await dynamoClient
                            .update({
                                TableName: DIGITARI_PUSH,
                                Key: {
                                    uid: tid,
                                    token: token.token,
                                },
                                UpdateExpression:
                                    "set backOffInterval = :bi, backOffTime = :bt",
                                ExpressionAttributeValues: {
                                    ":bi": 0,
                                    ":bt": 0,
                                },
                            })
                            .promise();
                    }

                    /*
                     * Finally, send push to this token
                     */
                    const newTickets = await expo.sendPushNotificationsAsync([
                        {
                            to: token.token,
                            data: {
                                type: notificationType,
                                content,
                            },
                            title: title.substring(0, 100),
                            body: body.substring(0, 500),
                            sound: "default",
                        },
                    ]);

                    let rateLimited = false;

                    /*
                     * Handle the ticket(s) produced from this bad boi
                     */
                    for (const newTicket of newTickets) {
                        if (newTicket.status === "ok") {
                            successfulTickets.push({
                                id: token.token,
                                time,
                                ticket: newTicket.id,
                            });
                        } else if (newTicket.status === "error") {
                            if (
                                !!newTicket?.details &&
                                !!newTicket.details?.error
                            ) {
                                if (
                                    newTicket.details.error ===
                                    "DeviceNotRegistered"
                                ) {
                                    await dynamoClient
                                        .delete({
                                            TableName: DIGITARI_PUSH,
                                            Key: {
                                                uid: tid,
                                                token: token.token,
                                            },
                                        })
                                        .promise();

                                    break;
                                } else if (
                                    newTicket.details.error ===
                                    "MessageRateExceeded"
                                ) {
                                    if (!rateLimited) {
                                        const interval =
                                            token.backOffInterval === 0
                                                ? 30
                                                : 2 * token.backOffInterval;

                                        await dynamoClient
                                            .update({
                                                TableName: DIGITARI_PUSH,
                                                Key: {
                                                    uid: tid,
                                                    token: token.token,
                                                },
                                                UpdateExpression:
                                                    "set backOffInterval = :bi, backOffTime = :bt",
                                                ExpressionAttributeValues: {
                                                    ":bi": interval,
                                                    ":bt": time,
                                                },
                                            })
                                            .promise();
                                    }

                                    rateLimited = true;
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // throw new Error(`Message failure ${e}`);
        }
    }

    /*
     * And now, all push messages should have been sent, and all the old
     * consumed receipts should be deleted.  The only thing left to do
     * should be to actually write the goddamn new receipts
     */
    for (let i = 0; i < successfulTickets.length; i += MAX_BATCH_WRITE_ITEMS) {
        const writeRequests = [];

        for (let k = 0; k < MAX_BATCH_WRITE_ITEMS; ++k) {
            /*
             * First check that we haven't reached the end
             * of successful tickets
             */
            if (i + k >= successfulTickets.length) {
                break;
            } else {
                const ticket = successfulTickets[i + k];

                /*
                 * Otherwise, add a record to
                 * the list of write records
                 */
                writeRequests.push({
                    PutRequest: {
                        Item: ticket,
                    },
                });
            }
        }

        if (writeRequests.length > 0) {
            await dynamoClient
                .batchWrite({
                    RequestItems: {
                        DigitariPushTickets: writeRequests,
                    },
                })
                .promise();
        }
    }
}
