import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DynamoDB, S3 } from "aws-sdk";
import { AppSyncIdentityCognito, AppSyncResolverEvent } from "aws-lambda";
import { EventArgs } from "./lambda_types/event_type";
import {
    POST_ADD_ON_CONTENT_MAX_LEN,
    POST_CONTENT_MAX_LEN,
    PostAddOn,
    PostTarget,
    PostType,
} from "../../global_types/PostTypes";
import { FOLLOW_USER_REWARD, UserType } from "../../global_types/UserTypes";
import {
    DIGITARI_BOLT_TRANSACTIONS,
    DIGITARI_COMMUNITIES,
    DIGITARI_POSTS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import { CommunityType } from "../../global_types/CommunityTypes";
import { v4 } from "uuid";
import { randomString } from "../../utils/string_utils";
import { tier2responseCost } from "../../utils/tier_utils";
import { ranking2Tier } from "../../global_types/TierTypes";
import {
    BoltTransactionType,
    TRANSACTION_TTL,
    TransactionIcon,
    TransactionTypesEnum,
} from "../../global_types/TransactionTypes";

const BUCKET_NAME = "digitari-imgs";
const s3Client = new S3();
const COST_PER_RECIPIENT = 10;

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(event: AppSyncResolverEvent<EventArgs>) {
    const {
        target,
        addOnContent,
        content,
        cmid,
        addOn,
        recipients,
    } = event.arguments;

    let finalAddOnContent = addOnContent;
    let finalRecipients = recipients;

    const pid = v4();
    const time = Date.now();
    const uid = (event.identity as AppSyncIdentityCognito).sub;

    /*
     * Do basic content length check
     */
    if (
        content.length > POST_CONTENT_MAX_LEN ||
        addOnContent.length > POST_ADD_ON_CONTENT_MAX_LEN
    ) {
        throw new Error("Either content or addOnContent is too long");
    }

    /*
     * Fetch user
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

    if (recipients > user.maxPostRecipients) {
        throw new Error("Can't post to more than your max post recipients!");
    }

    /*
     * Check recipients.  Only allow posting
     * to zero recipients if you're posting to your
     * followers and you have no followers
     */
    if (
        !(
            target === PostTarget.MyFollowers &&
            user.followers === 0 &&
            recipients === 0
        ) &&
        recipients < 1
    ) {
        throw new Error("Must post to at least one recipient");
    }

    let community: CommunityType;

    if (target === PostTarget.Community) {
        if (!!cmid) {
            community = (
                await dynamoClient
                    .get({
                        TableName: DIGITARI_COMMUNITIES,
                        Key: {
                            id: cmid,
                        },
                    })
                    .promise()
            ).Item as CommunityType;

            if (!community) {
                throw new Error("Cmid didn't correspond to a community");
            }
        } else {
            throw new Error(
                "Specified target is a community, but didn't specify community id"
            );
        }
    }

    /*
     * Alright, now we're seeing if we need to generate a presigned url
     */
    let presignedUrl: string;

    if (addOn === PostAddOn.Image) {
        /*
         * Generate presigned url for this post
         */
        if (!addOnContent.match(/\.(jpg|jpeg|png)$/)) {
            throw new Error("Not a correct file type for addOn image");
        }

        const imgSplit = addOnContent.split(".");
        const imgType = imgSplit[imgSplit.length - 1];

        const imgKey = `${pid}/p-${randomString(3)}.${imgType}`;

        presignedUrl = s3Client.getSignedUrl("putObject", {
            Bucket: BUCKET_NAME,
            Key: imgKey,
        });

        finalAddOnContent = `https://d3671gkd53urlb.cloudfront.net/${imgKey}`;
    }

    /*
     * Now we see how we're looking in terms of post target
     *
     * Our policy for posting is this: If the user requests more
     * recipients than the target has followers, then we simply decrease
     * the recipients to match the followers.  This sort of behavior should
     * have been stopped on client, so this shouldn't lead to bad UX for the
     * user
     */
    if (target === PostTarget.MyFollowers) {
        finalRecipients = Math.min(recipients, user.followers);
    } else {
        finalRecipients = Math.min(recipients, community.followers);
    }

    /*
     * Do a coin check to be sure the user has enough coin to
     * go through with this
     */
    if (COST_PER_RECIPIENT * finalRecipients > user.coin) {
        throw new Error("User doesn't have enough coin!");
    }

    const userTier = ranking2Tier(user.ranking);

    const responseCost = tier2responseCost(userTier);

    const post: PostType = {
        id: pid,
        uid,

        user: user.firstName,
        tier: userTier,
        time,
        content,

        addOn,
        addOnContent: finalAddOnContent,
        target,
        cmid,
        communityName: community?.name,
        responseCost,

        coin: 0,
        convoCount: 0,
        responseCount: 0,

        nameColor: user.nameColor,
        nameFont: user.nameFont,
        sticker: user.profileSticker,
    };

    const updatePromises: Promise<any>[] = [];

    /*
     * Ok, so now we're going to start out by actually making the post
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_POSTS,
                Item: {
                    id: pid,
                    uid,

                    recipients: finalRecipients,
                    distributed: false,

                    user: user.firstName,
                    tier: ranking2Tier(user.ranking),
                    time,
                    content,

                    addOn,
                    addOnContent: finalAddOnContent,
                    target,
                    cmid,
                    communityName: community?.name,
                    responseCost,

                    coin: 0,
                    convoCount: 0,
                    responseCount: 0,

                    nameColor: user.nameColor,
                    nameFont: user.nameFont,
                    sticker: user.profileSticker,
                },
            })
            .promise()
    );

    /*
     * Add the entry to the posts table
     */
    if (!!cmid) {
        updatePromises.push(
            rdsClient.executeSql(`INSERT INTO posts (uid, cmid, id, tier, time)
                                        VALUES ('${uid}', '${cmid}', '${pid}', '${userTier}', ${time});`)
        );
    } else {
        updatePromises.push(
            rdsClient.executeSql(`INSERT INTO posts (uid, id, tier, time)
                                        VALUES ('${uid}', '${pid}', '${userTier}', ${time});`)
        );
    }

    /*
     * Add bolt transaction
     */
    const boltTransaction: BoltTransactionType = {
        tid: uid,
        time,
        bolts: recipients,
        message: `You created a post: "${content}"`,
        transactionType: TransactionTypesEnum.Post,
        transactionIcon: TransactionIcon.Post,
        data: pid,
        ttl: Math.round(time / 1000) + TRANSACTION_TTL, // 24 hours past `time` in epoch seconds
    };

    /*
     * Send off bolt transaction
     */
    updatePromises.push(
        dynamoClient
            .put({
                TableName: DIGITARI_BOLT_TRANSACTIONS,
                Item: boltTransaction,
            })
            .promise()
    );

    await Promise.all(updatePromises);

    return {
        post,
        presignedUrl,
    };
}
