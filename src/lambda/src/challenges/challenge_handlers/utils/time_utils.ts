export function slightlyRandomTime(): number {
    return Date.now() + Math.round(1000 * Math.random());
}
