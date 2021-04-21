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
