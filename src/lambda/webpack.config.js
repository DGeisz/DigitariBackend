const path = require("path");

module.exports = {
    /*
     * Register all the different lambdas here
     */
    entry: {
        // update_profile_pic:
        //     "./src/lambdas/update_profile_pic/update_profile_pic.ts",
        // create_post: "./src/lambdas/create_post/create_post.ts",
        follow_user: "./src/lambdas/follow_user/follow_user.ts",
        // test_create_post_utils: "./src/lambdas/create_post/utils.test.ts",
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
