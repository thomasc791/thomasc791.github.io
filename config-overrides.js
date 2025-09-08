module.exports = function override(config, _) {
   const newRule = {
      test: /\.txt$/i,
      loader: 'raw-loader',
      options: {
         esModule: false,
      },
   }
   config.module.rules.find((r) => r.oneOf).oneOf.unshift(newRule)
   return config
}
