const path = require("path");

module.exports = {
    /*
     * Register all the different lambdas here
     */
    entry: {
        update_profile_pic:
            "./src/lambdas/update_profile_pic/update_profile_pic.ts",
        create_post: "./src/lambdas/create_post/create_post.ts",
        follow_user: "./src/lambdas/follow_user/follow_user.ts",
        unfollow_user: "./src/lambdas/unfollow_user/unfollow_user.ts",
        follow_community: "./src/lambdas/follow_community/follow_community.ts",
        unfollow_community:
            "./src/lambdas/unfollow_community/unfollow_community.ts",
        create_community: "./src/lambdas/create_community/create_community.ts",
        create_convo: "./src/lambdas/create_convo/create_convo.ts",
        dismiss_convo: "./src/lambdas/dismiss_convo/dismiss_convo.ts",
        block_convo: "./src/lambdas/block_convo/block_convo.ts",
        activate_convo: "./src/lambdas/activate_convo/activate_convo.ts",
        create_message: "./src/lambdas/create_message/create_message.ts",
        finish_convo: "./src/lambdas/finish_convo/finish_convo.ts",
        transaction_accumulation:
            "./src/lambdas/transaction_accumulation/transaction_accumulation.ts",
        collect_earnings: "./src/lambdas/collect_earnings/collect_earnings.ts",
        donate_to_post: "./src/lambdas/donate_to_post/donate_to_post.ts",
        block_post: "./src/lambdas/block_post/block_post.ts",
        delete_user: "./src/lambdas/delete_user/delete_user.ts",
        delete_post: "./src/lambdas/delete_post/delete_post.ts",
        gen_invite_code: "./src/lambdas/gen_invite_code/gen_invite_code.ts",
        create_user: "./src/lambdas/create_user/create_user.ts",
        process_iap: "./src/lambdas/process_iap/process_iap.ts",
        delete_community: "./src/lambdas/delete_community/delete_community.ts",
        distribute_post: "./src/lambdas/distribute_post/distribute_post.ts",
        upgrade_wallet: "./src/lambdas/upgrade_wallet/upgrade_wallet.ts",
        upgrade_bolt_wallet:
            "./src/lambdas/upgrade_bolt_wallet/upgrade_bolt_wallet.ts",
        level_up: "./src/lambdas/level_up/level_up.ts",
        search: "./src/lambdas/search/search.ts",
        top_results: "./src/lambdas/top_results/top_results.ts",
    },
    externals: ["aws-sdk"],
    mode: "production",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        modules: ["node_modules"],
        extensions: [".tsx", ".ts", ".js", ".json"],
    },
    target: "node",
    output: {
        path: path.join(__dirname, "dist"),
        filename: "[name].js",
        libraryTarget: "commonjs2",
    },
};
