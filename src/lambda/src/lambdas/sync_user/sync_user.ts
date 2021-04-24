// import { RdsClient } from "../../data_clients/rds_client/rds_client";
// import { DynamoDB } from "aws-sdk";
// import { AppSyncResolverEvent } from "aws-lambda";
// import { EventArgs } from "./lambda_types/event_args";
// import { UserType } from "../../global_types/UserTypes";
// import {
//     DIGITARI_COMMUNITIES,
//     DIGITARI_USERS,
// } from "../../global_types/DynamoTableNames";
// import { getFollowingWithActivity } from "./rds_queries/queries";
// import { SyncCommunityTarget, SyncUserTarget } from "./lambda_types/sync_types";
// import { CommunityType } from "../../global_types/CommunityTypes";
//
// const rdsClient = new RdsClient();
//
// const dynamoClient = new DynamoDB.DocumentClient({
//     apiVersion: "2012-08-10",
// });
//
// export async function handler(event: AppSyncResolverEvent<EventArgs>) {
//     const time = Date.now();
//     const uid = event.arguments.uid;
//
//     /*
//      * Start off by grabbing the user
//      */
//     const user: UserType = (
//         await dynamoClient
//             .get({
//                 TableName: DIGITARI_USERS,
//                 Key: {
//                     id: uid,
//                 },
//             })
//             .promise()
//     ).Item as UserType;
//
//     /*
//      * If it hasn't been a full day yet, then just return
//      */
//     if (time - user.lastSync < 24 * 3600 * 1000) {
//         return;
//     }
//
//     /*
//      * Fetch all the entities that the user is following
//      */
//     const followingTargets = await rdsClient.executeQuery(
//         getFollowingWithActivity(uid)
//     );
//
//     const userTargets = new Map<string, SyncUserTarget>();
//     const userTargetIds = [];
//
//     const communityTargets = new Map<string, SyncCommunityTarget>();
//     const communityTargetIds = [];
//
//     for (let target of followingTargets) {
//         if (target.entityType === 1) {
//             communityTargets.set(target.tid, {
//                 entity: target,
//             });
//             communityTargetIds.push(target.tid);
//         } else {
//             userTargets.set(target.tid, {
//                 entity: target,
//             });
//             userTargetIds.push(target.tid);
//         }
//     }
//
//     let externalPostsProvided = 0;
//
//     /*
//      * Do repeated batch gets to get all user information from dynamo
//      */
//     for (let i = 0; i < userTargetIds.length; i += 100) {
//         const userTargetKeys = [];
//
//         for (let k = 0; k < 100 && k + i < userTargetIds.length; k++) {
//             userTargetKeys.push({
//                 id: userTargetIds[i + k],
//             });
//         }
//
//         const batchResponse = (
//             await dynamoClient
//                 .batchGet({
//                     RequestItems: {
//                         DigitariUsers: {
//                             Keys: userTargetKeys,
//                         },
//                     },
//                 })
//                 .promise()
//         ).Responses;
//
//         if (!!batchResponse) {
//             const batchUsers: UserType[] = batchResponse.DigitariUsers as UserType[];
//
//             for (let batchUser of batchUsers) {
//                 const userTarget = userTargets.get(batchUser.id);
//
//                 if (!!userTarget) {
//                     externalPostsProvided += batchUser.meanPostsProvided;
//                     userTarget.user = batchUser;
//                 }
//             }
//         }
//     }
//
//     /*
//      * Do repeated batch gets to get all community information from dynamo
//      */
//     for (let i = 0; i < communityTargetIds.length; i += 100) {
//         const communityTargetKeys = [];
//
//         for (let k = 0; k < 100 && k + i < communityTargetIds.length; k++) {
//             communityTargetKeys.push({
//                 id: communityTargetIds[i + k],
//             });
//         }
//
//         const batchResponse = (
//             await dynamoClient
//                 .batchGet({
//                     RequestItems: {
//                         DigitariCommunities: {
//                             Keys: communityTargetKeys,
//                         },
//                     },
//                 })
//                 .promise()
//         ).Responses;
//
//         if (!!batchResponse) {
//             const batchComs: CommunityType[] = batchResponse.DigitariCommunities as CommunityType[];
//
//             for (let batchCom of batchComs) {
//                 const comTarget = communityTargets.get(batchCom.id);
//
//                 if (!!comTarget) {
//                     // externalPostsProvided += batchCom.meanPostsProvided;
//                 }
//             }
//         }
//     }
// }
