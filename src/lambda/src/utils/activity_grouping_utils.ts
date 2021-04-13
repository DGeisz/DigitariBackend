/**
 * Based on mean and std, we assign activity groupings
 * so that roughly 10% of an entity's following will be
 * in each activity grouping
 */
export function calculateActivityGrouping(
    sourceValue: number,
    targetMean: number,
    targetStd: number
): number {
    if (targetStd === 0) {
        return 5;
    }

    const normalized_value = (sourceValue - targetMean) / targetStd;

    if (normalized_value > 0) {
        if (normalized_value < 0.2533) {
            return 5;
        } else if (normalized_value < 0.5245) {
            return 6;
        } else if (normalized_value < 0.8415) {
            return 7;
        } else if (normalized_value < 1.2815) {
            return 8;
        } else {
            return 9;
        }
    } else {
        if (normalized_value > -0.2533) {
            return 4;
        } else if (normalized_value > -0.5245) {
            return 3;
        } else if (normalized_value > -0.8415) {
            return 2;
        } else if (normalized_value > -1.2815) {
            return 1;
        } else {
            return 0;
        }
    }
}
