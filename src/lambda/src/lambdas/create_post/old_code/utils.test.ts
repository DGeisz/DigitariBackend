import { getTierPostAllocation, sumReduce, transpose } from "./utils";

const postsRequested = [9, 1, 5, 6, 3, 0];
const postsProvided = [12, 6, 1, 3, 0, 0];

const out = getTierPostAllocation(
    postsRequested,
    postsProvided,
    0.8
) as number[][];

console.log(out);

const totalReq = sumReduce(postsRequested);

console.log(
    "Normalized requested:",
    postsRequested.map((req) => req / totalReq)
);

const yen = out.map((o, i) => o.map((e) => e * postsProvided[i]));
const yote = transpose(yen).map((row) => sumReduce(row));
const totalYote = sumReduce(yote);

console.log(
    "Normalized allocation:",
    yote.map((y) => y / totalYote)
);
