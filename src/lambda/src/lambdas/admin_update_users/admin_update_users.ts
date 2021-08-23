import { DynamoDB } from "aws-sdk";
import {
    DIGITARI_COMMUNITIES,
    DIGITARI_FEED_RECORDS,
    DIGITARI_POSTS,
    DIGITARI_USERS,
} from "../../global_types/DynamoTableNames";
import {
    BioFonts,
    NameFonts,
    ProfileColors,
    ProfileStickers,
    UserType,
} from "../../global_types/UserTypes";
import { PostType } from "../../global_types/PostTypes";
import { BoltRecord } from "../../global_types/BoltRecord";
import { FeedRecordType } from "../../global_types/FeedRecordTypes";
import { Client } from "@elastic/elasticsearch";
import { CommunityType } from "../../global_types/CommunityTypes";

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    cloud: {
        id: process.env.ES_CLOUD_ID,
    },
    auth: {
        username: process.env.ES_CLOUD_USERNAME,
        password: process.env.ES_CLOUD_PASSWORD,
    },
});

export async function handler() {
    const updatePromises: Promise<any>[] = [];

    // await esClient.deleteByQuery({
    //     index: "search",
    //     body: {
    //         query: {
    //             term: {
    //                 entityType: 0,
    //             },
    //         },
    //     },
    // });
    //
    // await esClient.deleteByQuery({
    //     index: "search",
    //     body: {
    //         query: {
    //             term: {
    //                 entityType: 1,
    //             },
    //         },
    //     },
    // });
    //
    // const comms = (
    //     await dynamoClient
    //         .scan({
    //             TableName: DIGITARI_COMMUNITIES,
    //         })
    //         .promise()
    // ).Items as CommunityType[];
    //
    const users = (
        await dynamoClient
            .scan({
                TableName: DIGITARI_USERS,
            })
            .promise()
    ).Items as UserType[];

    for (let user of users) {
        if (user.maxWallet < 800) {
            updatePromises.push(
                dynamoClient
                    .update({
                        TableName: DIGITARI_USERS,
                        Key: {
                            id: user.id,
                        },
                        UpdateExpression: `set maxFollowing = :mfg,
                                           maxFollowers = :mfs,
                                           maxWallet = :mw`,
                        ExpressionAttributeValues: {
                            ":mfg": user.following + 2,
                            ":mfs": user.followers + 1,
                            ":mw": 800,
                        },
                    })
                    .promise()
            );
        }
    }

    //
    //
    // console.log("Starting update");
    //
    // for (let user of users) {
    //     updatePromises.push(
    //         esClient.index({
    //             index: "search",
    //             id: user.id,
    //             body: {
    //                 id: user.id,
    //                 name: `${user.firstName.trim()} ${user.lastName.trim()}`,
    //                 followers: user.followers,
    //                 entityType: 0,
    //             },
    //         })
    //     );
    // }
    //
    // for (let com of comms) {
    //     updatePromises.push(
    //         esClient.index({
    //             index: "search",
    //             id: com.id,
    //             body: {
    //                 id: com.id,
    //                 name: com.name,
    //                 followers: com.followers,
    //                 entityType: 1,
    //             },
    //         })
    //     );
    // }
    //
    // updatePromises.push(
    //     dynamoClient
    //         .update({
    //             TableName: DIGITARI_USERS,
    //             Key: {
    //                 id: user.id,
    //             },
    //             UpdateExpression: `set maxBoltWallet = :h,
    //                                    boltTransTotal = :z`,
    //             ExpressionAttributeValues: {
    //                 ":h": 100,
    //                 ":z": 0,
    //             },
    //         })
    //         .promise()
    // );

    await Promise.all(updatePromises);

    // const posts = (
    //     await dynamoClient.scan({ TableName: DIGITARI_POSTS }).promise()
    // ).Items as PostType[];

    // const second = Date.now();
    //
    // console.log("First elapsed:", (second - first) / 1000);

    // for (let post of posts) {
    //     updatePromises.push(
    //         dynamoClient
    //             .update({
    //                 TableName: DIGITARI_POSTS,
    //                 Key: {
    //                     id: post.id,
    //                 },
    //                 UpdateExpression: `set walletBonusEnd = :wb, maxWallet = :mw`,
    //                 ExpressionAttributeValues: {
    //                     ":wb": 0,
    //                     ":mw": 100,
    //                 },
    //             })
    //             .promise()
    //     );
    // }

    // const third = Date.now();
    //
    // console.log("Second elapsed:", (third - second) / 1000);

    // for (let user of users) {
    //     updatePromises.push(
    //         dynamoClient
    //             .update({
    //                 TableName: DIGITARI_USERS,
    //                 Key: {
    //                     id: user.id,
    //                 },
    //                 UpdateExpression: `set nameFont = :nf,
    //                                        nameFontsPurchased = :nfp,
    //                                        nameColor = :nc,
    //                                        nameColorsPurchased = :ncp,
    //                                        bioFont = :bf,
    //                                        bioFontsPurchased = :bfp,
    //                                        bioColor = :bc,
    //                                        bioColorsPurchased = :bcp,
    //                                        profileSticker = :ps,
    //                                        profileStickersPurchased = :psp
    //                                        `,
    //                 ExpressionAttributeValues: {
    //                     ":nf": NameFonts.Default,
    //                     ":nfp": [NameFonts.Default],
    //                     ":nc": ProfileColors.Default,
    //                     ":ncp": [ProfileColors.Default],
    //                     ":bf": BioFonts.Default,
    //                     ":bfp": [BioFonts.Default],
    //                     ":bc": ProfileColors.Default,
    //                     ":bcp": [ProfileColors.Default],
    //                     ":ps": ProfileStickers.Default,
    //                     ":psp": [ProfileStickers.Default],
    //                 },
    //             })
    //             .promise()
    //     );
    // }

    // await Promise.all(updatePromises);
    //
    // const fourth = Date.now();
    //
    // console.log("Third elapsed:", (fourth - third) / 1000);

    // const { uid } = event;
    //
    // const user = (
    //     await dynamoClient
    //         .get({
    //             TableName: DIGITARI_USERS,
    //             Key: {
    //                 id: uid,
    //             },
    //         })
    //         .promise()
    // ).Item as UserType;
    //
    // console.log("Here's the user: ", user);
    //
    // const postIds = (
    //     await dynamoClient
    //         .query({
    //             TableName: DIGITARI_FEED_RECORDS,
    //             KeyConditionExpression: "uid = :uid",
    //             ExpressionAttributeValues: {
    //                 ":uid": uid,
    //             },
    //             ScanIndexForward: false,
    //             Limit: 10,
    //         })
    //         .promise()
    // ).Items as FeedRecordType[];
    //
    // console.log("Here are post ids: ", postIds);
    //
    // const batchRequest = [];
    // const boltRequest = [];
    //
    // for (let postId of postIds) {
    //     batchRequest.push({ id: postId.pid });
    //
    //     boltRequest.push({
    //         pid: postId.pid,
    //         uid,
    //     });
    // }
    //
    // const batchResult = (
    //     await dynamoClient
    //         .batchGet({
    //             RequestItems: {
    //                 DigitariPosts: {
    //                     Keys: batchRequest,
    //                 },
    //                 DigitariBoltRecords: {
    //                     Keys: boltRequest,
    //                 },
    //             },
    //         })
    //         .promise()
    // ).Responses;
    //
    // const posts: PostType[] = batchResult.DigitariPosts as PostType[];
    // const boltRecords = batchResult.DigitariBoltRecords as BoltRecord[];
    //
    // console.log("Here are the posts: ", posts, boltRecords);
    //
    // for (let record of boltRecords) {
    //     for (let post of posts) {
    //         if (record.pid === post.id) {
    //             post.boltsBought = record.count;
    //             break;
    //         }
    //     }
    // }
    //
    // console.log("Posts post records: ", posts);
}
