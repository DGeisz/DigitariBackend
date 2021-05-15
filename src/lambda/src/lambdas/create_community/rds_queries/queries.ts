import { FieldList } from "aws-sdk/clients/rdsdataservice";
import { QueryPackage } from "../../../data_clients/rds_client/rds_client";

function booleanParser(_row: FieldList): boolean {
    return true;
}

export function insertCommunityRow(cmid: string): QueryPackage<boolean> {
    return {
        sql: `INSERT INTO communities VALUES ('${cmid}', 0);`,
        resultParser: booleanParser,
    };
}
