import { FieldList } from "aws-sdk/clients/rdsdataservice";
import { PostRecord } from "../../../global_types/PostTypes";
import { QueryPackage } from "../../../data_clients/rds_client/rds_client";

function followPostParser(row: FieldList): PostRecord {
    return {
        pid: row[0].stringValue,
        time: row[1].longValue,
    };
}

export function getCommPostRecords(tid: string): QueryPackage<PostRecord> {
    return {
        sql: `SELECT id, time FROM posts WHERE cmid='${tid}' ORDER BY time DESC LIMIT 200`,
        resultParser: followPostParser,
    };
}
