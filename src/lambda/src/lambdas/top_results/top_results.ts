import { Client } from "@elastic/elasticsearch";
import { DynamoDB } from "aws-sdk";
import { AppSyncResolverEvent } from "aws-lambda";
import { UserType } from "../../global_types/UserTypes";

const esClient = new Client({
    cloud: {
        id: process.env.ES_CLOUD_ID,
    },
    auth: {
        username: process.env.ES_CLOUD_USERNAME,
        password: process.env.ES_CLOUD_PASSWORD,
    },
});

const dynamoClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});

export async function handler(
    event: AppSyncResolverEvent<{
        offset?: number;
        entityType?: number;
    }>
) {
    const { offset, entityType } = event.arguments;

    let from = 0;

    if (!!offset) {
        from = offset;
    }

    let body = {
        query: {},
        sort: [
            {
                followers: {
                    order: "desc",
                },
            },
        ],
        from,
        size: 50,
    };

    if (typeof entityType === "number") {
        body.query = {
            term: {
                entityType,
            },
        };
    } else {
        body.query = {
            match_all: {},
        };
    }

    const result = await esClient.search({
        index: "search",
        body,
    });

    const initialHits = result.body.hits.hits.map((hit: any) => {
        return hit._source;
    });

    const uids: { id: string }[] = [];

    for (let hit of initialHits) {
        if (hit.entityType === 0) {
            uids.push({
                id: hit.id,
            });
        }
    }

    if (uids.length > 0) {
        const batchResponse = (
            await dynamoClient
                .batchGet({
                    RequestItems: {
                        DigitariUsers: {
                            Keys: uids,
                        },
                    },
                })
                .promise()
        ).Responses;

        const users: UserType[] = batchResponse.DigitariUsers as UserType[];

        for (let user of users) {
            for (let hit of initialHits) {
                if (hit.id === user.id) {
                    hit.imgUrl = user.imgUrl;
                }
            }
        }
    }

    return initialHits;
}
