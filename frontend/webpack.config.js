const { createExpoWebpackConfigAsync } = require('@expo/webpack-config');

module.exports = async function (env, argv) {
    const config = await createExpoWebpackConfigAsync(env, argv);

    config.resolve.extensions = [
        '.web.tsx', '.web.ts', '.web.jsx', '.web.js',
        ...config.resolve.extensions
    ];

    return config;
};
