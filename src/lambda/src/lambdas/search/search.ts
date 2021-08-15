import { Client } from "@elastic/elasticsearch";
import { AppSyncResolverEvent } from "aws-lambda";

const esClient = new Client({
    cloud: {
        id: process.env.ES_CLOUD_ID,
    },
    auth: {
        username: process.env.ES_CLOUD_USERNAME,
        password: process.env.ES_CLOUD_PASSWORD,
    },
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

    if (typeof entityType !== "undefined") {
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

    return result.body;
}
