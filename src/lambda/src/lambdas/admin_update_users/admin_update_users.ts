import { DynamoDB } from "aws-sdk";
import {
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

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler() {
    const users = (
        await dynamoClient
            .scan({
                TableName: DIGITARI_USERS,
            })
            .promise()
    ).Items as UserType[];

    const first = Date.now();

    const updatePromises: Promise<any>[] = [];

    for (let user of users) {
        updatePromises.push(
            dynamoClient
                .update({
                    TableName: DIGITARI_USERS,
                    Key: {
                        id: user.id,
                    },
                    UpdateExpression: `set walletBonusEnd = :wb, maxWallet = :mw`,
                    ExpressionAttributeValues: {
                        ":wb": 0,
                        ":mw": 100,
                    },
                })
                .promise()
        );
    }

    // const posts = (
    //     await dynamoClient.scan({ TableName: DIGITARI_POSTS }).promise()
    // ).Items as PostType[];

    const second = Date.now();

    console.log("First elapsed:", (second - first) / 1000);

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

    const third = Date.now();

    console.log("Second elapsed:", (third - second) / 1000);

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

    await Promise.all(updatePromises);

    const fourth = Date.now();

    console.log("Third elapsed:", (fourth - third) / 1000);
}
