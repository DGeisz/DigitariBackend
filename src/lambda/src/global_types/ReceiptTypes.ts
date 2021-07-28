export interface ReceiptType {
    receipt: string;
    uid: string;
    /*
     * Pending is used to indicate a receipt hasn't been verified yet
     * This field helps me debug
     */
    pending?: boolean;
}
