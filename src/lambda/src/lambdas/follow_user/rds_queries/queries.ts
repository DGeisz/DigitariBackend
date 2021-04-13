import { FieldList } from "aws-sdk/clients/rdsdataservice";
import { QueryPackage } from "../../../data_clients/rds_client/rds_client";

function followsParser(_row: FieldList): boolean {
    return true;
}

export function insertFollowRow(
    tid: string,
    sid: string,
    tname: string,
    sname: string,
    time: number,
    activityGroup: number,
    tier: number,
    postsRequested: number
): QueryPackage<boolean> {
    return {
        sql: `INSERT INTO follows VALUES 
        ('${tid}', '${sid}', :tname, :sname, ${time}, 0, ${activityGroup}, ${tier}, ${postsRequested});`,
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
