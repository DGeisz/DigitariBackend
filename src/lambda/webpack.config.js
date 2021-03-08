const path = require("path");

module.exports = {
    /*
     * Register all the different lambdas here
     */
    entry: {
        create_post: "./src/lambdas/create_post/create_post.ts",
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
