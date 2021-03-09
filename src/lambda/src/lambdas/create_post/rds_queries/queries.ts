/**
 * Creates a query package to get all the followers of a
 * particular user
 */
import { QueryPackage } from "../../../data_clients/rds_client/rds_client";
import { FieldList } from "aws-sdk/clients/rdsdataservice";

function followersParser(row: FieldList): string {
    return row[0].stringValue;
}

export function getAllFollowersQueryPackage(uid: string): QueryPackage<string> {
    return {
        sql: `SELECT sid FROM follows WHERE tid=${uid}`,
        resultParser: followersParser,
    };
}

export function getRandomActivityGroupFollowers(
    uid: string,
    activityGroup: number,
    numFollowers: number
): QueryPackage<string> {
    return {
        sql: `SELECT sid FROM follows 
              WHERE tid=${uid} AND activity_group=${activityGroup}
              ORDER BY RAND()
              LIMIT ${numFollowers}
              `,
        resultParser: followersParser,
    };
}

export function getAllActivityGroupFollowers(
    uid: string,
    activityGroup: number
): QueryPackage<string> {
    return {
        sql: `SELECT sid FROM follows 
              WHERE tid=${uid} AND activity_group=${activityGroup}
              `,
        resultParser: followersParser,
    };
}
