import { DynamoDB } from "aws-sdk";
import { RdsClient } from "../../data_clients/rds_client/rds_client";
import { DIGITARI_COMMUNITIES } from "../../global_types/DynamoTableNames";
import { Client } from "@elastic/elasticsearch";

const rdsClient = new RdsClient();

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

const esClient = new Client({
    cloud: {
        id: process.env.ES_CLOUD_ID,
    },
    auth: {
        username: process.env.ES_CLOUD_USERNAME,
        password: process.env.ES_CLOUD_PASSWORD,
    },
});

interface Event {
    cmid: string;
}

export async function handler(event: Event) {
    const { cmid } = event;

    try {
        await rdsClient.executeSql(
            `DELETE FROM follows WHERE tid = "${cmid}" OR sid = "${cmid}"`
        );
    } catch (e) {
        console.log("Follow delete failed:", e);
    }

    try {
        await rdsClient.executeSql(
            `DELETE FROM communities WHERE id = "${cmid}"`
        );
    } catch (e) {
        console.log("Communities rds delete failed:", e);
    }

    try {
        await dynamoClient
            .delete({
                TableName: DIGITARI_COMMUNITIES,
                Key: {
                    id: cmid,
                },
            })
            .promise();
    } catch (e) {
        console.log("Dynamo delete failed: ", e);
    }

    try {
        console.log(
            "Here's search: ",
            JSON.stringify(
                await esClient.search({
                    index: "search",
                })
            )
        );
    } catch (e) {
        console.log("Error fetting search: ", e);
    }

    try {
        await esClient.delete({
            index: "search",
            id: cmid,
        });
    } catch (e) {
        console.log("Search delete failed:", e);
    }

    try {
        await esClient.deleteByQuery({
            index: "search",
            body: {
                query: {
                    match: {
                        id: cmid,
                    },
                },
            },
        });
    } catch (e) {
        console.log("Search delete failed 2:", e);
    }
}
