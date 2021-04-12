import { DynamoDB, S3 } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "./lambda_types/event_type";

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

    // const imgSplit = imgName.split(".");
    // const imgType = imgSplit[imgSplit.length - 1];

    const imgKey = `${uid}/${imgName}`;

    const presignedUrl = s3Client.getSignedUrl("putObject", {
        Bucket: BUCKET_NAME,
        Key: imgKey,
    });

    const imgUrl = `https://${BUCKET_NAME}.s3.us-east-2.amazonaws.com/${imgKey}`;

    await dynamoClient
        .update({
            TableName: "DigitariUsers",
            Key: {
                id: uid,
            },
            UpdateExpression: "set imgUrl = :imgUrl",
            ExpressionAttributeValues: {
                ":imgUrl": imgUrl,
            },
        })
        .promise();

    return {
        presignedUrl,
        url: imgUrl,
    };
}
