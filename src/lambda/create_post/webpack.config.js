module.exports = {
    entry: "./src/create_post.ts",
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
        filename: "lambda.js",
        libraryTarget: "commonjs2",
        // library: "lambda",
    },
};
