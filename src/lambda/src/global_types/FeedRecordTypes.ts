import { PutItemInputAttributeMap } from "aws-sdk/clients/dynamodb";

export interface FeedRecordType {
    /**
     * Id of the user who owns this
     * feed
     */
    uid: string;
    /**
     * The time that the post was created
     */
    time: number;
    /**
     * The id of the post
     */
    pid: string;
}

/**
 * Convert feed record into DynamoDbJson
 * for use with Batch write
 */
export function FeedRecord2DynamoJson(
    record: FeedRecordType
): PutItemInputAttributeMap {
    return {
        uid: { S: record.uid },
        time: { N: record.time.toString() },
        pid: { S: record.pid },
    };
}
