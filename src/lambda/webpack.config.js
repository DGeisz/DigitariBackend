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
