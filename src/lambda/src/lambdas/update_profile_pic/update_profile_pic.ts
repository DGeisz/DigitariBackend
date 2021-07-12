import { DynamoDB, S3 } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "./lambda_types/event_type";
import { randomString } from "../../utils/string_utils";
import { DIGITARI_USERS } from "../../global_types/DynamoTableNames";
import {
    CHANGE_PROFILE_PIC_PRICE,
    UserType,
} from "../../global_types/UserTypes";

const BUCKET_NAME = "digitari-imgs";

const s3Client = new S3();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(event: AppSyncResolverEvent<EventArgs>) {
    const uid = (event.identity as AppSyncIdentityCognito).sub;
    const imgName = event.arguments.imgName;

    if (!imgName.match(/\.(jpg|jpeg|png)$/)) {
        throw new Error("Not a correct file type");
    }

    /*
     * Get the user
     */
    const user = (
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
     * Make sure user has enough digibolts
     */
    if (user.bolts < CHANGE_PROFILE_PIC_PRICE) {
        throw new Error("User doesn't have enough bolts!");
    }

    const imgSplit = imgName.split(".");
    const imgType = imgSplit[imgSplit.length - 1];

    const imgKey = `${uid}/p-${randomString(3)}.${imgType}`;

    const presignedUrl = s3Client.getSignedUrl("putObject", {
        Bucket: BUCKET_NAME,
        Key: imgKey,
    });

    const imgUrl = `https://d3671gkd53urlb.cloudfront.net/${imgKey}`;

    await dynamoClient
        .update({
            TableName: "DigitariUsers",
            Key: {
                id: uid,
            },
            UpdateExpression: `set imgUrl = :imgUrl,
                                   bolts = bolts - :price`,
            ExpressionAttributeValues: {
                ":imgUrl": imgUrl,
                ":price": CHANGE_PROFILE_PIC_PRICE,
            },
        })
        .promise();

    return {
        presignedUrl,
        url: imgUrl,
    };
}
