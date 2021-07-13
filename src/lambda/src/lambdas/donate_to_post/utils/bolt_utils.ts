import { XXHash32 } from "ts-xxhash";
import { BOLT_HASH_SEED } from "../../../global_types/PostTypes";

const MAX_VAL = 10;

export function userPost2BoltCount(uid: string, pid: string): number {
    const uniform =
        (XXHash32.hash(BOLT_HASH_SEED)
            .update(pid)
            .update(uid)
            .digest()
            .toNumber() %
            1000) /
        1000;

    return Math.floor(Math.cbrt(MAX_VAL ** 3 * (uniform - 1)) + MAX_VAL) + 1;
}
