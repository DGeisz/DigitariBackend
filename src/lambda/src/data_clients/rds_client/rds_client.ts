import { RDSDataService } from "aws-sdk";
import { FieldList } from "aws-sdk/clients/rdsdataservice";

export interface QueryPackage<T> {
    sql: string;
    resultParser: (row: FieldList) => T;
}

export class RdsClient {
    private readonly dataService: RDSDataService;

    constructor() {
        this.dataService = new RDSDataService();
    }

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
            })
            .promise();

        /*
         * Check to be sure that rows were actually
         * even returned
         */
        if (data.records) {
            /*
             * Apply the result parser to obtain the parsed list of returned objects
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
