import { UserType } from "../global_types/UserTypes";
import { DynamoDB } from "aws-sdk";
import { receivedFromConvosHandler } from "./challenge_handlers/received_from_convos/received_from_convos";
import { spentOnConvosHandler } from "./challenge_handlers/spent_on_convos/spent_on_convos";
import { successfulConvosHandler } from "./challenge_handlers/successful_convos/successful_convos";
import { postCountHandler } from "./challenge_handlers/post_count/post_count";
import { followersHandler } from "./challenge_handlers/followers/followers";
import { followingHandler } from "./challenge_handlers/following/following";

export async function challengeCheck(
    user: UserType,
    dynamoClient: DynamoDB.DocumentClient
) {
    await receivedFromConvosHandler(user, dynamoClient);
    await spentOnConvosHandler(user, dynamoClient);
    await successfulConvosHandler(user, dynamoClient);
    await postCountHandler(user, dynamoClient);
    await followersHandler(user, dynamoClient);
    await followingHandler(user, dynamoClient);
}
