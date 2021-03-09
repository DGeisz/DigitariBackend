/**
 * Get the sum of the elements in an array of numbers
 * */
export function sumReduce(arr: number[]): number {
    return arr.reduce((acc, curr) => acc + curr);
}

/**
 * Return the transpose of a list of lists
 */
export function transpose(arr: number[][]) {
    return arr[0].map((_, colIndex) => arr.map((row) => row[colIndex]));
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

/**
 * Takes in a list of the number of posts supplied
 * per day per tier, and the number of posts requested
 * per day per tier, and returns a list of lists. Each
 * entry in the outer list corresponds the the allocation
 * of posts to each tier for the given tier.  So if the
 * return is [[a0, a1, a2, ...], ...] and the user is in tier 0
 * and posting to N feeds, N * a0 will go to tier zero, N * a1 will
 * go to tier 1, N * a2 go to tier two etc. If the user is in
 * tier 1, then they'd fetch the second entry in the outer list
 * and do the same thing
 *
 * If the caller specifies their tier and the number of posts
 * they're sending out, then just return a list with the actual
 * allocation of posts to different tiers.  Otherwise, return
 * the entire allocation matrix
 *
 * The whole purpose of this function is to provide a way
 * for all the tiers to (hopefully) get the number of
 * posts they request, and to make sure that each tier is
 * getting a mix of posts from tiers around it.
 * */
export function getTierPostAllocation(
    postsRequestedPerTier: number[],
    postsProvidedPerTier: number[],
    initialMix: number,
    tier?: number,
    postCount?: number
): number[][] | number[] {
    /*
     * Make sure initial mix is between 0 and 1
     */
    if (initialMix > 1 || initialMix < 0) {
        throw new Error("Initial mix must be between 0 and 1");
    }

    /*
     * Make sure the arrays provided
     * have the same length
     */
    if (postsProvidedPerTier.length !== postsRequestedPerTier.length) {
        throw new Error(`Posts requested has 
        different number of tiers than posts provided`);
    }

    const numTiers = postsProvidedPerTier.length;

    /*
     * Make sure there are more than one tier
     */
    if (numTiers < 2) {
        throw new Error("Must be more than two tiers");
    }

    const totalReq = sumReduce(postsRequestedPerTier);
    const totalProvided = sumReduce(postsProvidedPerTier);

    /*
     * If either no posts have been provided or requested
     * simply return an allocation of `initialMix` percent
     * to the tier, and `1 - initialMix` to the surrounding
     * tiers
     */
    if (totalReq === 0 || totalProvided === 0) {
        return postsRequestedPerTier.map((_, i) => {
            const tierAllocation = new Array(numTiers).fill(0);

            tierAllocation[i] = initialMix;
            const otherMix = 1 - initialMix;

            if (i === 0) {
                tierAllocation[1] = otherMix;
            } else if (i === normProvided.length - 1) {
                tierAllocation[i - 1] = otherMix;
            } else {
                tierAllocation[i - 1] = otherMix / 2;
                tierAllocation[i + 1] = otherMix / 2;
            }

            return tierAllocation;
        });
    }

    /*
     * Normalize the requested and posted arrays so we
     * can compare them on the same footing
     */
    const normRequested = postsRequestedPerTier.map((req) => req / totalReq);
    const normProvided = postsProvidedPerTier.map(
        (prov) => prov / totalProvided
    );

    /*
     * Now them, initialize the allocation matrix, with the initial mix
     */
    let allocation: number[][] = normProvided.map((prov, index) => {
        /*
         * Start of by sending `initialMix` percent of posts within a tier, and
         * `1 - initialMix` percent of posts to tiers directly around a given tier
         */
        const tierAllocation = new Array(numTiers).fill(0);
        const otherMix = 1 - initialMix;

        tierAllocation[index] = initialMix * prov;

        if (index === 0) {
            tierAllocation[1] = otherMix * prov;
        } else if (index === normProvided.length - 1) {
            tierAllocation[index - 1] = otherMix * prov;
        } else {
            tierAllocation[index - 1] = (otherMix / 2) * prov;
            tierAllocation[index + 1] = (otherMix / 2) * prov;
        }

        return tierAllocation;
    });

    /*
     * Transpose the allocation matrix
     */
    let transAlloc = transpose(allocation);

    /*
     * Initialize the surplus matrix, which
     * will hold the surplus posts provided by
     * each tier
     */
    let surplus = new Array(numTiers).fill(0);

    /*
     * Initialize the deficit matrix, which will
     * hold the number of additional posts required
     * at each tier than were provided with the initial
     * mix
     */
    let deficit = new Array(numTiers).fill(0);

    /*
     * For each tier, get the surplus posts to the tier,
     * adjust transAlloc if necessary, and report any deficit
     * that has occurred
     */
    for (let i = 0; i < transAlloc.length; ++i) {
        const tierReceived = transAlloc[i];

        /*
         * Get the number of posts distributed to the tier
         */
        const totalReceived = sumReduce(tierReceived);
        const requested = normRequested[i];

        /*
         * Check for surplus or deficit
         */
        if (!!totalReceived && totalReceived > requested) {
            /*
             * Calculate the surplus associated with each
             * tier, and add it to the total surplus
             */

            const tieredSurplus = tierReceived.map(
                (rec) => ((totalReceived - requested) / totalReceived) * rec
            );

            for (let j = 0; j < surplus.length; ++j) {
                surplus[j] += tieredSurplus[j];
            }

            /*
             * Now then, remove the tiered surplus from transAlloc,
             * so the present tier receives the correct amount of posts
             */
            for (let j = 0; j < surplus.length; ++j) {
                tierReceived[j] -= tieredSurplus[j];
            }
        } else {
            /*
             * We're in a deficit, so we're going to calculate the size
             * of the deficit, and report it in the deficit array
             */
            deficit[i] = requested - totalReceived;
        }
    }

    /*
     * Calculate the total size of the deficit
     */
    const totalDeficit = sumReduce(deficit);

    if (totalDeficit > 0) {
        /*
         * Loop though deficit, and if the deficit is non-zero,
         * take posts from the surplus array according to the normalized
         * size of the deficit at the given tier
         */

        for (let tierIndex = 0; tierIndex < deficit.length; ++tierIndex) {
            const tierDeficit = deficit[tierIndex];

            if (tierDeficit > 0) {
                for (
                    let surplusIndex = 0;
                    surplusIndex < surplus.length;
                    ++surplusIndex
                ) {
                    const tierSurplus = surplus[surplusIndex];

                    /*
                     * We're going to add the normalized surplus
                     * to the row in the transAllocation matrix
                     * corresponding to tierIndex
                     */
                    transAlloc[tierIndex][surplusIndex] +=
                        (tierDeficit / totalDeficit) * tierSurplus;
                }
            }
        }

        /*
         * Set allocation to be the transpose of tier allocation
         */
        allocation = transpose(transAlloc);
    }

    /*
     * Finally, normalize each row of the allocation, and
     */
    const normAllocation = allocation.map((row) => {
        const rowTotal = sumReduce(row);

        if (rowTotal !== 0) {
            return row.map((col) => col / rowTotal);
        } else {
            return new Array(numTiers).fill(0);
        }
    });

    /*
     * If the caller provided their tier, only return the tier
     */
    if (typeof tier !== "undefined") {
        const tierAllocation = normAllocation[tier];

        /*
         * If caller provided the number of posts they're
         * sending out, then multiply the tier allocation
         * by the number of posts, and round to the nearest
         * integer
         */
        if (typeof postCount !== "undefined") {
            return tierAllocation.map((tierCount) =>
                Math.round(postCount * tierCount)
            );
        } else {
            /*
             * ...otherwise, just return the normalized allocation
             */
            return tierAllocation;
        }
    } else {
        /*
         * If the caller didn't provide their tier, return
         * the entire allocation matrix
         */

        return normAllocation;
    }
}
