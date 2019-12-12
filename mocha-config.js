// Mocha configs consumed by truffle-config.js, toggled by process.env.<MODE>.
// Idea borrowed from AragonOS.

/**
 * Run mocha with gas usage analytics - output to docs: env: GAS_DOCS
 * @type {Object}
 */
const mochaGasSettingsDocs = {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
        currency: 'GBP',
        gasPrice: 5,
        onlyCalledMethods: true,
        rst: true,
        rstTitle: 'Appendix: Gas Usage',
        outputFile: 'docs/Gas.rst',
        noColors: true
    }
};

// Assign
let mochaSettings = {};

if (process.env.GAS_REPORTER) mochaSettings = mochaGasSettingsDocs;

module.exports = mochaSettings;
