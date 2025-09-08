module.exports = {
    plugins: {
        cssnano: {
            preset: [
                'default',
                {
                    // Disable SVGO to avoid the 'stable' dependency
                    svgo: false,
                }
            ]
        }
    }
}
