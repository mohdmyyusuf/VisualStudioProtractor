// An example configuration file.
var HTMLReporter = require('protractor-beautiful-reporter')

exports.config = {
  directConnect: true,

  // Capabilities to be passed to the webdriver instance.
  capabilities: {
    'browserName': 'chrome'
  },

  // Framework to use. Jasmine is recommended.
  framework: 'jasmine',

  // Spec patterns are relative to the current working directory when
  // protractor is called.
  specs: ['..//TestCases//MouseActions.js'],

  onPrepare: function(){
          jasmine.getEnv().addReporter(new HTMLReporter({
            baseDirectory: 'Reports/screenshots'

          }).getJasmine2Reporter());

  },

  // Options to be passed to Jasmine.
  jasmineNodeOpts: {
    defaultTimeoutInterval: 30000
  }
};
