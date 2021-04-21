import { FieldList } from "aws-sdk/clients/rdsdataservice";
import { QueryPackage } from "../../../data_clients/rds_client/rds_client";

function followersParser(row: FieldList): string {
    return row[0].stringValue;
}

export function getActiveFollowers(
    uid: string,
    activeTime: number,
    numFollowers: number
): QueryPackage<string> {
    return {
        sql: `SELECT sid FROM follows
              WHERE tid=${uid} AND time > ${activeTime}
              ORDER BY RAND()
              LIMIT ${numFollowers}`,
        resultParser: followersParser,
    };
}

export function getInactiveFollowers(
    uid: string,
    activeTime: number,
    numFollowers: number
): QueryPackage<string> {
    return {
        sql: `SELECT sid FROM follows
              WHERE tid=${uid} AND time < ${activeTime}
              ORDER BY RAND()
              LIMIT ${numFollowers}`,
        resultParser: followersParser,
    };
}
