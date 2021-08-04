import { PushNotificationType } from "../global_types/PushTypes";
import { DynamoDB } from "aws-sdk";
import { ExtendedUserType } from "../global_types/UserTypes";
import { DIGITARI_USERS } from "../global_types/DynamoTableNames";
import { sendPushAndHandleReceipts } from "./push";
import { millisInMinute } from "../utils/time_utils";
import { toCommaRep } from "../utils/value_rep_utils";

const PUSH_BACKOFF_COUNT = "pushBackoffCount";
const PUSH_BACKOFF_THRESHOLD = "pushBackoffThreshold";
const PUSH_BACKOFF_TIME = "pushBackoffTime";

/**
 * This function handles backoff
 * push notifications, where we use
 * exponential backoff to prevent users from
 * being overrun with push notifications.
 *
 * Especially in relation to bolt spending events
 * (which are totally overwhelming)
 */
export async function backoffPush(
    tid: string,
    notificationType: PushNotificationType,
    content: string,
    title: string,
    body: string,
    dynamoClient: DynamoDB.DocumentClient
) {
    /*
     * First, we fetch the user
     */
    const user: ExtendedUserType = (
        await dynamoClient
            .get({
                TableName: DIGITARI_USERS,
                Key: {
                    id: tid,
                },
            })
            .promise()
    ).Item as ExtendedUserType;

    /*
     * If user doesn't exist, immediately return
     */
    if (!user) {
        return;
    }

    const time = Date.now();
    const nextBackoffTime = time + 5 * millisInMinute;
    const updatePromises: Promise<any>[] = [];

    /*
     * Start off with the case where the backoff
     * variables aren't defined on user
     */
    if (
        typeof user.pushBackoffCount == "undefined" ||
        typeof user.pushBackoffThreshold == "undefined" ||
        typeof user.pushBackoffTime == "undefined"
    ) {
        /*
         * We're going to update the user with the proper fields,
         * and then send the notification
         */
        updatePromises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_USERS,
                    Key: {
                        id: tid,
                    },
                    UpdateExpression: `set ${PUSH_BACKOFF_COUNT} = :unit,
                                           ${PUSH_BACKOFF_THRESHOLD} = :z,
                                           ${PUSH_BACKOFF_TIME} = :t`,
                    ExpressionAttributeValues: {
                        ":unit": 1,
                        ":z": 0,
                        ":t": nextBackoffTime,
                    },
                })
                .promise()
        );

        updatePromises.push(
            sendPushAndHandleReceipts(
                tid,
                notificationType,
                content,
                title,
                body,
                dynamoClient
            )
        );
    } else {
        /*
         * Ok, now handle the case where the fields
         * exist on the user.
         *
         * First deal with case where the threshold is
         * zero, because this indicates that we send
         * push every message
         */
        if (user.pushBackoffThreshold == 0) {
            /*
             * If the backoff time is greater than the current
             * time, then the backoff count is in affect.
             */
            if (user.pushBackoffTime > time) {
                if (user.pushBackoffCount >= 5) {
                    /*
                     * If the backoff count has reached 5, it's time to
                     * start suppressing messages, which we do by increasing backoff
                     * threshold
                     */
                    updatePromises.push(
                        dynamoClient
                            .update({
                                TableName: DIGITARI_USERS,
                                Key: {
                                    id: tid,
                                },
                                UpdateExpression: `set ${PUSH_BACKOFF_COUNT} = :z,
                                           ${PUSH_BACKOFF_THRESHOLD} = :nt,
                                           ${PUSH_BACKOFF_TIME} = :t`,
                                ExpressionAttributeValues: {
                                    ":z": 0,
                                    ":nt": 5,
                                    ":t": nextBackoffTime,
                                },
                            })
                            .promise()
                    );
                } else {
                    /*
                     * Otherwise, we send the message and increase
                     * the backoff count
                     */
                    updatePromises.push(
                        dynamoClient
                            .update({
                                TableName: DIGITARI_USERS,
                                Key: {
                                    id: tid,
                                },
                                UpdateExpression: `set ${PUSH_BACKOFF_COUNT} = ${PUSH_BACKOFF_COUNT} + :unit`,
                                ExpressionAttributeValues: {
                                    ":unit": 1,
                                },
                            })
                            .promise()
                    );

                    updatePromises.push(
                        sendPushAndHandleReceipts(
                            tid,
                            notificationType,
                            content,
                            title,
                            body,
                            dynamoClient
                        )
                    );
                }
            } else {
                /*
                 * If the current time is greater than the backoff time,
                 * that means the users hasn't received a message since backoff
                 *
                 * So we simply reset all the backoff variables (with count = 1),
                 * and we send the message
                 */
                updatePromises.push(
                    dynamoClient
                        .update({
                            TableName: DIGITARI_USERS,
                            Key: {
                                id: tid,
                            },
                            UpdateExpression: `set ${PUSH_BACKOFF_COUNT} = :unit,
                                                   ${PUSH_BACKOFF_THRESHOLD} = :z,
                                                   ${PUSH_BACKOFF_TIME} = :t`,
                            ExpressionAttributeValues: {
                                ":unit": 1,
                                ":z": 0,
                                ":t": nextBackoffTime,
                            },
                        })
                        .promise()
                );

                updatePromises.push(
                    sendPushAndHandleReceipts(
                        tid,
                        notificationType,
                        content,
                        title,
                        body,
                        dynamoClient
                    )
                );
            }
        } else {
            /*
             * In this case, we have backoff suppression enabled.
             * First we have to check if we've passed the backoff time
             */
            if (user.pushBackoffTime > time) {
                /*
                 * If we haven't passed the backoff time,
                 * then suppression is still enabled.
                 * Check if we've passed the threshold
                 */
                if (user.pushBackoffCount >= user.pushBackoffThreshold) {
                    /*
                     * If the count is greater than the threshold,
                     * then we're going to send the message, indicating
                     * we suppressed pushBackoffCount messages.
                     *
                     * Then we're going to increase the threshold and time
                     */
                    updatePromises.push(
                        sendPushAndHandleReceipts(
                            tid,
                            notificationType,
                            content,
                            title,
                            `${body} (and ${toCommaRep(
                                user.pushBackoffCount
                            )} more)`,
                            dynamoClient
                        )
                    );

                    updatePromises.push(
                        dynamoClient
                            .update({
                                TableName: DIGITARI_USERS,
                                Key: {
                                    id: tid,
                                },
                                UpdateExpression: `set ${PUSH_BACKOFF_COUNT} = :z,
                                           ${PUSH_BACKOFF_THRESHOLD} = :nt,
                                           ${PUSH_BACKOFF_TIME} = :t`,
                                ExpressionAttributeValues: {
                                    ":z": 0,
                                    ":nt": 2 * user.pushBackoffThreshold,
                                    ":t": nextBackoffTime,
                                },
                            })
                            .promise()
                    );
                } else {
                    /*
                     * Otherwise, we simply increase the backoff count,
                     * and don't send the message
                     */
                    updatePromises.push(
                        dynamoClient
                            .update({
                                TableName: DIGITARI_USERS,
                                Key: {
                                    id: tid,
                                },
                                UpdateExpression: `set ${PUSH_BACKOFF_COUNT} = ${PUSH_BACKOFF_COUNT} + :unit`,
                                ExpressionAttributeValues: {
                                    ":unit": 1,
                                },
                            })
                            .promise()
                    );
                }
            } else {
                /*
                 * In this case, the time is greater than the backoff time,
                 * which means we passed the threshold time.
                 *
                 * So we send the message, and either cut the backoff threshold
                 * in half, or just set it equal to zero and let all messages through
                 */
                let newBody: string;

                if (user.pushBackoffCount > 0) {
                    newBody = `${body} (and ${toCommaRep(
                        user.pushBackoffCount
                    )} more)`;
                } else {
                    newBody = body;
                }

                updatePromises.push(
                    sendPushAndHandleReceipts(
                        tid,
                        notificationType,
                        content,
                        title,
                        newBody,
                        dynamoClient
                    )
                );

                /*
                 * Ok, now reset the backoff threshold and backoff time
                 */
                let newThreshold: number;

                if (user.pushBackoffThreshold > 5) {
                    newThreshold = Math.round(user.pushBackoffThreshold / 2);
                } else {
                    newThreshold = 0;
                }

                updatePromises.push(
                    dynamoClient
                        .update({
                            TableName: DIGITARI_USERS,
                            Key: {
                                id: tid,
                            },
                            UpdateExpression: `set ${PUSH_BACKOFF_COUNT} = :z,
                                           ${PUSH_BACKOFF_THRESHOLD} = :nt,
                                           ${PUSH_BACKOFF_TIME} = :t`,
                            ExpressionAttributeValues: {
                                ":z": 0,
                                ":nt": newThreshold,
                                ":t": nextBackoffTime,
                            },
                        })
                        .promise()
                );
            }
        }
    }

    await Promise.allSettled(updatePromises);
}
