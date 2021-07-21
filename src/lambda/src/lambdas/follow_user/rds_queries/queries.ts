import { FieldList } from "aws-sdk/clients/rdsdataservice";
import { QueryPackage } from "../../../data_clients/rds_client/rds_client";
import { PostRecord } from "../../../global_types/PostTypes";

function followsParser(_row: FieldList): boolean {
    return true;
}

export function insertFollowRow(
    tid: string,
    sid: string,
    tname: string,
    sname: string,
    time: number,
    entityType: number
): QueryPackage<boolean> {
    return {
        sql: `INSERT INTO follows VALUES 
        ('${tid}', '${sid}', :tname, :sname, ${time}, ${entityType}, ${time});`,
        resultParser: followsParser,
        parameters: [
            {
                name: "tname",
                value: {
                    stringValue: tname,
                },
            },
            {
                name: "sname",
                value: {
                    stringValue: sname,
                },
            },
        ],
    };
}

export function followChecker(tid: string, sid: string): QueryPackage<boolean> {
    return {
        sql: `SELECT * FROM follows WHERE tid='${tid}' AND sid='${sid}'`,
        resultParser: followsParser,
    };
}

/*
 * Get the last 50 post ids and times from this user
 */
function followPostParser(row: FieldList): PostRecord {
    return {
        pid: row[0].stringValue,
        time: row[1].longValue,
    };
}

export function getUserPostRecords(tid: string): QueryPackage<PostRecord> {
    return {
        sql: `SELECT id, time FROM posts WHERE uid='${tid}' ORDER BY time DESC LIMIT 50`,
        resultParser: followPostParser,
    };
}
