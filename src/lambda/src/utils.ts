/**
 * Passed into a reducer on an array of numbers
 * to calculated the sum of all numbers in the array
 * */
function sumReduce(acc: number, curr: number): number {
    return acc + curr;
}

/**
 * Takes the number of posts supplied at each
 * tier and the number of posts demanded at each tier
 * and returns the number of posts allocated to a
 * particular tier per tier
 * */
export function tierAllocation(
    tierSupply: number[],
    tierDemand: number[]
): number[][] {
    if (tierSupply.length != tierDemand.length || tierSupply.length < 2) {
        throw new Error(
            "Number of tiers for supply and demand must be equal and greater than 2"
        );
    }

    const numTiers = tierSupply.length;

    const supplyTotal: number = tierSupply.reduce(sumReduce);
    const normalizedSupply = tierSupply.map((item) => item / supplyTotal);

    const demandTotal: number = tierDemand.reduce(sumReduce);
    const normalizedDemand = tierDemand.map((item) => item / demandTotal);

    let tierAllocation = normalizedSupply.map((item, index) => {
        let allocation: number[] = new Array<number>(numTiers).fill(0);

        if (index === numTiers - 1) {
            allocation[numTiers - 1] = 0.8 * item;
            allocation[numTiers - 2] = 0.2 * item;
        } else if (index === 0) {
            allocation[0] = 0.8 * item;
            allocation[1] = 0.2 * item;
        } else {
            allocation[index] = 0.8 * item;
            allocation[index - 1] = 0.1 * item;
            allocation[index + 1] = 0.1 * item;
        }

        return allocation;
    });

    return [[]];
}
