// http://eslint.org/docs/user-guide/configuring

module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module'
  },
  env: {
    browser: true,
  },
  // https://github.com/standard/standard/blob/master/docs/RULES-en.md
  extends: 'standard',
  // required to lint *.vue files
  plugins: [
    'html'
  ],
  // add your custom rules here
  'rules': {
    // Disable semi colon checking
    "semi": [2, "always"],
    // allow paren-less arrow functions
    'arrow-parens': 0,

    "space-before-function-paren": 0,
    "no-multiple-empty-lines": 0,
    "quotes": 0,
    "comma-dangle": 0,
    "no-unused-vars": 0,
    "spaced-comment": 0,
    "padded-blocks": 0,
    "no-undef": 0,
    "no-trailing-spaces": 0,
    "no-fallthrough": 0,

    // allow async-await
    'generator-star-spacing': 0,
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0
  }
};
