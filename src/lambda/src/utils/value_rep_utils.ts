export function toRep(val: number) {
    if (val < 1000) {
        return val;
    } else if (val < 100000) {
        return (val / 1000).toFixed(1) + "k";
    } else if (val < 1000000) {
        return (val / 1000).toFixed(0) + "k";
    } else if (val < 100000000) {
        return (val / 1000000).toFixed(1) + "m";
    } else if (val < 1000000000) {
        return (val / 1000000).toFixed(0) + "m";
    }
    return (val / 1000000000).toFixed(1) + "b";
}

export function toCommaRep(val: number) {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
