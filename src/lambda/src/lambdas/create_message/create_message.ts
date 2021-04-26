import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "./lambda_types/event_args";
import { MESSAGE_MAX_LEN, MessageType } from "../../global_types/MessageTypes";
import { getConvo } from "../dismiss_convo/rds_queries/queries";
import { DIGITARI_MESSAGES } from "../../global_types/DynamoTableNames";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<EventArgs>
): Promise<MessageType> {
    const time = Date.now();
    const uid = (event.identity as AppSyncIdentityCognito).sub;

    const { message, cvid } = event.arguments;

    /*
     * Make sure the message isn't too long
     */
    if (message.length > MESSAGE_MAX_LEN) {
        throw new Error("Message exceeds the max threshold!");
    }

    /*
     * Grab the convo associated with this post
     */
    const convo = (await rdsClient.executeQuery(getConvo(cvid)))[0];

    /*
     * Now let's make sure this user is a participant in the convo
     */
    if (uid !== convo.tid && uid !== convo.suid) {
        throw new Error("Only convo participants may post messages");
    }

    /*
     * Make sure the convo is actually active
     */
    if (convo.status !== 1) {
        throw new Error("Users can only send messages in active convos");
    }

    /*
     * Now we figure out all the necessary fields for the message
     */
    let messageUid;
    let messageTid;
    let messageUser;
    let anonymous;

    if (convo.tid === uid) {
        messageUid = uid;
        messageTid = convo.sid;
        messageUser = convo.tname;
        anonymous = false;
    } else {
        messageUid = convo.sid;
        messageTid = convo.tid;
        messageUser = convo.sname;
        anonymous = convo.sanony;
    }

    /*
     * If the user is the target, then we should also increment target_msg_count
     * in the convos table
     */
    let targetStatement;

    if (uid === convo.tid) {
        targetStatement = ", target_msg_count = target_msg_count + 1";
    } else {
        targetStatement = "";
    }

    /*
     * Now update the convo with last time and last msg
     */
    await rdsClient.executeSql(
        `UPDATE convos SET last_time=${time}, last_msg=:msg${targetStatement} WHERE id='${cvid}'`,
        [
            {
                name: "msg",
                value: {
                    stringValue: message,
                },
            },
        ]
    );

    /*
     * Create the actual messages in the digitari messages
     */
    await dynamoClient
        .put({
            TableName: DIGITARI_MESSAGES,
            Item: {
                id: cvid,
                anonymous,
                content: message,
                time,
                uid: messageUid,
                tid: messageTid,
                user: messageUser,
            },
        })
        .promise();

    return {
        id: cvid,
        anonymous,
        content: message,
        time: time.toString(),
        uid: messageUid,
        tid: messageTid,
        user: messageUser,
    };
}
