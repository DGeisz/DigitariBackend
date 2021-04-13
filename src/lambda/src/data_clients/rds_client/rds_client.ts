import { RDSDataService } from "aws-sdk";
import { FieldList, SqlParametersList } from "aws-sdk/clients/rdsdataservice";

export interface QueryPackage<T> {
    sql: string;
    resultParser: (row: FieldList) => T;
    parameters?: SqlParametersList;
}

export class RdsClient {
    private readonly dataService: RDSDataService;

    constructor() {
        this.dataService = new RDSDataService();
    }

    /*
     * Execute the sql query in the query package, and
     * use the result parser to parse the list of
     * returned rows into objects
     */
    async executeQuery<T>(query: QueryPackage<T>): Promise<T[]> {
        /*
         * First, use the service to execute the sql query
         */
        const data = await this.dataService
            .executeStatement({
                secretArn: process.env.SECRET_ARN,
                resourceArn: process.env.CLUSTER_ARN,
                sql: query.sql,
                database: process.env.DATABASE,
                parameters: query.parameters,
            })
            .promise();

        /*
         * Check to be sure that rows were actually
         * even returned
         */
        if (data.records) {
            /*
             * Apply the result parser to obtain a list of parsed objects
             */
            return data.records.map(query.resultParser);
        } else {
            /*
             * If there are no records, return an empty list
             */
            return [];
        }
    }
}
