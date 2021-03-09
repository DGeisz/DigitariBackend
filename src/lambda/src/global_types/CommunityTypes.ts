export const COMMUNITY_TYPENAME = "Community";

export interface CommunityType {
    id: string;
    uid: string;
    name: string;
    amFollowing: boolean;
    followPrice: number;
    description: string;
    followers: number;
    timeCreated: string;

    // Fields pertaining to post distribution
    /**
     * Price of putting a post into the feed of
     * one of this community's followers
     */
    postPrice: number;
    /** The number of posts per day provided
     * to this community organized by tier
     */
    postsProvidedByTier: number[];
    /**
     * The number of posts desired by followers
     * per day of this community at this tier
     */
    postsDesiredByTier: number[];
    /**
     * The mean number of posts desired by followers
     * per day of this community at each tier
     */
    meanPostsDesiredByTier: number[];
    /**
     * The standard deviation of the number of posts
     * desired per day by followers of this community at each tier
     */
    stdPostsDesiredByTier: number[];
    /**
     * Each tier has its own set of activity groupings,
     * so the outer array corresponds to tiers, ie [t0, t1, t2 ...]
     * and each inner array corresponds to the number of posts
     * desired for that activity grouping at that tier,
     * ie [[ag0_t0, ag1_t0, ag2_t0, ...], [ag0_t1, ag1_t1, ag2_t1, ...], ...]
     */
    postsRequestedForActivityGroupingsByTier: number[][];
    /**
     * This array of arrays is organized like postsRequested...ByTier
     * (the previous field), but each number corresponds to the number
     * of users in each tiered activity grouping
     */
    activityGroupingSizeByTier: number[][];
}
