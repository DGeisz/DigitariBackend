import { QueryPackage } from "../../../data_clients/rds_client/rds_client";
import { FieldList } from "aws-sdk/clients/rdsdataservice";

function followEntityParser(_row: FieldList): boolean {
    return true;
}

export function getFollowEntity(
    tid: string,
    sid: string
): QueryPackage<boolean> {
    return {
        sql: `SELECT tid, sid FROM follows WHERE tid='${tid}' AND sid='${sid}';`,
        resultParser: followEntityParser,
    };
}
