export interface ConvoCoverType {
    // Convo ids
    id: string;
    pid: string;

    // Static fields
    time: number;
    msg: string;

    // Source user fields
    sid: string;
    sranking: number;
    sname: string;
    sviewed: boolean;
    sanony: boolean;

    // Target user fields
    tid: string;
    tranking: number;
    tname: string;
    tviewed: boolean;
}
