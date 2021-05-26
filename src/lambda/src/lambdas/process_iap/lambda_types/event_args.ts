import { ProductId } from "./coin_types";

export interface EventArgs {
    receipt: string;
    productId: ProductId;
    ios: boolean;
}
