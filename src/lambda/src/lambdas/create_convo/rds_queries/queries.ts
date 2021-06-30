import { FieldList } from "aws-sdk/clients/rdsdataservice";
import { QueryPackage } from "../../../data_clients/rds_client/rds_client";

function truthParser(_row: FieldList): boolean {
    return true;
}

export function checkForConvo(
    uid: string,
    hid: string,
    pid: string
): QueryPackage<boolean> {
    return {
        sql: `SELECT sid FROM convos
              WHERE (sid='${uid}' OR sid='${hid}') AND pid='${pid}'`,
        resultParser: truthParser,
    };
}

export function createConvo(
    id: string,
    pid: string,
    cmid: string,

    time: number,
    message: string,

    sid: string,
    suid: string,
    stier: number,
    sranking: number,
    sname: string,
    sanony: boolean,

    tid: string,
    ttier: number,
    tranking: number,
    tname: string,

    responseCost: number
): QueryPackage<boolean> {
    return {
        sql: `INSERT INTO convos 
        (id, pid, cmid, status, initial_time, initial_msg, last_time, last_msg, sid, suid, stier, sranking, sname, sanony, sviewed, tid, ttier, tranking, tname, tviewed, target_msg_count, response_cost)
        VALUES
        ('${id}', '${pid}', '${cmid}', 0, ${time}, :msg, ${time}, :msg, '${sid}', '${suid}', ${stier}, ${sranking}, :sname, ${sanony}, true, '${tid}', ${ttier}, ${tranking}, :tname, false, 0, ${responseCost})`,
        resultParser: truthParser,
        parameters: [
            {
                name: "msg",
                value: {
                    stringValue: message,
                },
            },
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
