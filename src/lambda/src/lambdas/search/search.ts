import { Client } from "@elastic/elasticsearch";
import { AppSyncResolverEvent } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
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
        text: string;
        offset?: number;
        entityType?: number;
    }>
) {
    const { text, offset, entityType } = event.arguments;

    let from = 0;

    if (!!offset) {
        from = offset;
    }

    const body = {
        from: from,
        size: 50,
        query: {
            bool: {
                must: [
                    {
                        function_score: {
                            query: {
                                match: {
                                    name: {
                                        query: text,
                                        fuzziness: "AUTO",
                                    },
                                },
                            },
                            field_value_factor: {
                                field: "followers",
                                modifier: "log1p",
                            },
                            boost_mode: "sum",
                        },
                    },
                ],
                should: {
                    function_score: {
                        query: {
                            match: {
                                name: {
                                    query: text,
                                },
                            },
                        },
                        field_value_factor: {
                            field: "followers",
                            modifier: "log1p",
                        },
                        boost_mode: "sum",
                    },
                },
            },
        },
    };

    if (typeof entityType === "number") {
        body.query.bool.must.push({
            //@ts-ignore
            term: {
                entityType,
            },
        });
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
