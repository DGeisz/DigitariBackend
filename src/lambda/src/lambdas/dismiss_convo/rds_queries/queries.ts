import { FieldList } from "aws-sdk/clients/rdsdataservice";
import { ExtendedConvoType } from "../../../global_types/ConvoTypes";
import { QueryPackage } from "../../../data_clients/rds_client/rds_client";

function convoParser(row: FieldList): ExtendedConvoType {
    return {
        id: row[0].stringValue,
        pid: row[1].stringValue,
        cmid: row[2].stringValue,

        status: row[3].longValue,

        initialTime: row[4].longValue.toString(),
        initialMsg: row[5].stringValue,

        lastTime: row[6].longValue.toString(),
        lastMsg: row[7].stringValue,

        sid: row[8].stringValue,
        suid: row[20].stringValue,
        stier: row[9].longValue,
        sranking: row[10].longValue,
        sname: row[11].stringValue,
        sanony: row[12].booleanValue,
        sviewed: row[13].booleanValue,
        sourceMsgCount: row[22].longValue,

        tid: row[14].stringValue,
        ttier: row[15].longValue,
        tranking: row[16].longValue,
        tname: row[17].stringValue,
        tviewed: row[18].booleanValue,
        targetMsgCount: row[19].longValue,

        responseCost: row[21].longValue,
    };
}

export function getConvo(cvid: string): QueryPackage<ExtendedConvoType> {
    return {
        resultParser: convoParser,
        sql: `SELECT id, pid, cmid, status,
                   initial_time as initialTime, initial_msg as initialMsg,
                   last_time as lastTime, last_msg as lastMsg,
                   sid, stier, sranking, sname, sanony, sviewed,
                   tid, ttier, tranking, tname, tviewed, target_msg_count as targetMsgCount, suid,
                   response_cost as responseCost, source_msg_count as sourceMsgCount
                   FROM convos WHERE id='${cvid}'`,
    };
}
