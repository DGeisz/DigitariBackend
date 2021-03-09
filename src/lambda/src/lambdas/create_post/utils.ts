/**
 * Get the sum of the elements in an array of numbers
 * */
export function sumReduce(arr: number[]): number {
    return arr.reduce((acc, curr) => acc + curr);
}

/**
 * Takes in a list of the number of posts desired in
 * each activity grouping, and randomly selects one activity
 * grouping.  The probability of an activity grouping being
 * selected is proportional to the normalized number of posts
 * desired by that activity grouping
 */
export function selectWeightedRandomActivityGroup(
    postsRequestedForActivityGroupings: number[]
): number {
    /*
     * Make sure postsRequested is a non-empty array.
     * Should be unreachable, but it's just in case
     */
    if (!postsRequestedForActivityGroupings.length) {
        return -1;
    }

    const totalPosts = sumReduce(postsRequestedForActivityGroupings);

    /*
     * Make sure there are groups requesting a non-zero
     * amount of posts
     */
    if (totalPosts <= 0) {
        return -1;
    }

    /*
     * Normalize the posts requested so that they sum to 1
     */
    const normalizedRequests = postsRequestedForActivityGroupings.map(
        (req) => req / totalPosts
    );

    /*
     * Randomly pick a number between 0 and 1, and check this number
     * against the cumulative probability distribution (cpd) defined by the
     * normalized requests
     */
    const randomChoice = Math.random();
    let accumulation = 0;

    for (const [index, normReq] of normalizedRequests.entries()) {
        accumulation += normReq;

        /*
         * If the choice is less than the accumulation, then
         * that means the choice corresponds to index's area
         * of the cpd
         */
        if (randomChoice <= accumulation) {
            return index;
        }
    }

    /*
     * This should be unreachable, but in case it isn't, (maybe
     * because of floating point) return the highest index in the
     * array
     */

    return postsRequestedForActivityGroupings.length - 1;
}
