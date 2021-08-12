var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 130944,
        "browser": {
            "name": "chrome",
            "version": "86.0.4240.193"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00440071-0041-00e5-0043-005600b400f6.png",
        "timestamp": 1605687744974,
        "duration": 10836
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 130944,
        "browser": {
            "name": "chrome",
            "version": "86.0.4240.193"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0017004c-004f-0077-009f-001b00c4002b.png",
        "timestamp": 1605687756194,
        "duration": 5900
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11888,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00550056-0046-008c-0056-008400870043.png",
        "timestamp": 1613820936805,
        "duration": 11796
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11888,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c0074-00c5-0098-00ad-0020003700ff.png",
        "timestamp": 1613820950200,
        "duration": 7045
    },
    {
        "description": "first it|Describe one",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14720,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006d0040-00df-00b8-003b-007b00d900d9.png",
        "timestamp": 1613823492303,
        "duration": 8
    },
    {
        "description": "second it|Describe two",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14720,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004d00ae-005f-00fb-00cc-00f2004d0074.png",
        "timestamp": 1613823492828,
        "duration": 7
    },
    {
        "description": "third it|Describe three",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14720,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006400d7-0098-0086-006e-00bc0062005c.png",
        "timestamp": 1613823493259,
        "duration": 3
    },
    {
        "description": "second it|Describe two",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8316,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00df008a-0026-00ce-0058-004700510058.png",
        "timestamp": 1613900509377,
        "duration": 13
    },
    {
        "description": "first it|Describe one",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 8316,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00bb00d0-00d4-0015-0088-006b00140045.png",
        "timestamp": 1613900509811,
        "duration": 0
    },
    {
        "description": "third it|Describe three",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 8316,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00c2007c-0041-00a6-0082-0014003400f9.png",
        "timestamp": 1613900509845,
        "duration": 0
    },
    {
        "description": "second it|Describe two",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15196,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00140054-0009-000a-0050-00c7000d0002.png",
        "timestamp": 1613900539298,
        "duration": 9
    },
    {
        "description": "first it|Describe one",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 15196,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00f500bf-00f5-00b5-0025-006500010091.png",
        "timestamp": 1613900539749,
        "duration": 0
    },
    {
        "description": "third it|Describe three",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 15196,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "005a008a-002f-00f0-00a5-004600f9004f.png",
        "timestamp": 1613900539794,
        "duration": 1
    },
    {
        "description": "second it|Describe to test expect and matcher",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17136,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": [
            "Expected 100 to equal 99."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\ExpectMatcher.js:4:22)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "004f004a-0008-0077-0010-00fe004800f3.png",
        "timestamp": 1613902391801,
        "duration": 59
    },
    {
        "description": "second it|Describe to test expect and matcher",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16588,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.182"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00580012-0071-0091-00c5-00c40034005c.png",
        "timestamp": 1613902435087,
        "duration": 22
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17036,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c0077-00a3-0074-00c5-004e00110087.png",
        "timestamp": 1621856240668,
        "duration": 8063
    },
    {
        "description": "Validate title|mySuite",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17036,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unknown error: failed to change window state to 'normal', current state is 'maximized'\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.18363 x86_64)"
        ],
        "trace": [
            "WebDriverError: unknown error: failed to change window state to 'normal', current state is 'maximized'\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: WebDriver.manage().window().maximize()\n    at Driver.schedule (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Window.maximize (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1686:25)\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:16:35)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\nFrom: Task: Run it(\"Validate title\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:12:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00900054-0034-0022-000f-000500870082.png",
        "timestamp": 1621856249950,
        "duration": 5879
    },
    {
        "description": "Validate url|mySuite",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 17036,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "001c0033-00dd-00b1-0039-0073002c006a.png",
        "timestamp": 1621856255972,
        "duration": 0
    },
    {
        "description": "Validate title|mySuite",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 17036,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "0006000d-0014-0096-001b-0083001d0052.png",
        "timestamp": 1621856255987,
        "duration": 1
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11796,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00290030-0065-00ab-00f7-003100d00089.png",
        "timestamp": 1621856414445,
        "duration": 7850
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11796,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621856423300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856423335,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856423362,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856428784,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856428784,
                "type": ""
            }
        ],
        "screenShotFile": "0083000c-009f-00d4-007f-0075002900fb.png",
        "timestamp": 1621856422426,
        "duration": 6374
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11796,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ef00db-00a0-004d-00ef-00a5003d009f.png",
        "timestamp": 1621856429042,
        "duration": 5934
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11796,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a000a-0060-008c-002a-002400cb0050.png",
        "timestamp": 1621856435095,
        "duration": 5576
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18396,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009c006b-0087-00d4-00ba-00c60025004a.png",
        "timestamp": 1621856571166,
        "duration": 8826
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18396,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856580835,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856580873,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621856580920,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856586724,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856586724,
                "type": ""
            }
        ],
        "screenShotFile": "00a40030-0071-0007-008b-00db0009003e.png",
        "timestamp": 1621856580122,
        "duration": 6619
    },
    {
        "description": "Validate url|mySuite",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18396,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Expected 'https://angularjs.org/' to be 'https://angular.io/'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:29:41)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00fb0030-000e-0007-001a-00a800a300f9.png",
        "timestamp": 1621856586965,
        "duration": 5973
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18396,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000d0087-008a-00a3-00f4-004e00dc0065.png",
        "timestamp": 1621856593040,
        "duration": 5594
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00260072-004d-004b-0084-00f70068005e.png",
        "timestamp": 1621856636854,
        "duration": 8518
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621856645945,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856646082,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856646127,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856651713,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856651713,
                "type": ""
            }
        ],
        "screenShotFile": "0001005e-0019-0009-00de-00f6001d0036.png",
        "timestamp": 1621856645541,
        "duration": 6218
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621856653888,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856653893,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856653895,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856653896,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856653896,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621856654205,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856654226,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621856654241,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856659630,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621856659630,
                "type": ""
            }
        ],
        "screenShotFile": "005700dd-00d3-0090-0082-000a00f7008c.png",
        "timestamp": 1621856651986,
        "duration": 7684
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f40030-00d4-0052-003f-007200660040.png",
        "timestamp": 1621856659886,
        "duration": 5891
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1248,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004f00e1-0078-001e-00a5-000300d5006e.png",
        "timestamp": 1621857356904,
        "duration": 8648
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1248,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621857366340,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621857366374,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621857366423,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621857372126,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621857372126,
                "type": ""
            }
        ],
        "screenShotFile": "00580072-00f9-0022-0010-00a40040007c.png",
        "timestamp": 1621857365777,
        "duration": 6357
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1248,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621857373819,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621857373863,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621857373892,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621857379487,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621857379487,
                "type": ""
            }
        ],
        "screenShotFile": "000000a1-008b-0001-0039-0049004b00a9.png",
        "timestamp": 1621857372478,
        "duration": 7031
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1248,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ad00fc-0027-005c-00f1-00ba00f100da.png",
        "timestamp": 1621857379940,
        "duration": 6144
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1248,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/vendor/bootstrap/js/bootstrap.min.js 5:17547 Uncaught Error: Bootstrap dropdown require Popper.js (https://popper.js.org)",
                "timestamp": 1621857388353,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 27:7 Uncaught TypeError: Cannot read property 'addEventListener' of null",
                "timestamp": 1621857388363,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://chercher.tech/practice/popups - [DOM] Found 3 elements with non-unique id #textbar: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1621857388382,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/practice/popups 0:0 Uncaught SyntaxError: Unexpected end of JSON input",
                "timestamp": 1621857388940,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 9:52 Uncaught TypeError: Cannot read property 'setAttribute' of null",
                "timestamp": 1621857389452,
                "type": ""
            }
        ],
        "screenShotFile": "00d80000-00a4-007b-00ae-00cd009c0036.png",
        "timestamp": 1621857386426,
        "duration": 3179
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16120,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00360050-00fd-0020-008f-00f3006a0012.png",
        "timestamp": 1621857486377,
        "duration": 8106
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16120,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621857495200,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621857495274,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621857495320,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621857500883,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621857500884,
                "type": ""
            }
        ],
        "screenShotFile": "003000d1-003f-0055-0096-00fa00150053.png",
        "timestamp": 1621857494693,
        "duration": 6213
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16120,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621857502493,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621857502565,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621857502585,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621857508007,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621857508007,
                "type": ""
            }
        ],
        "screenShotFile": "00c600fc-00d6-00a4-0021-00590082001f.png",
        "timestamp": 1621857501402,
        "duration": 6623
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16120,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a0007e-0069-003a-002e-00cc00a80024.png",
        "timestamp": 1621857508438,
        "duration": 6084
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16120,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/vendor/bootstrap/js/bootstrap.min.js 5:17547 Uncaught Error: Bootstrap dropdown require Popper.js (https://popper.js.org)",
                "timestamp": 1621857516206,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 27:7 Uncaught TypeError: Cannot read property 'addEventListener' of null",
                "timestamp": 1621857516215,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://chercher.tech/practice/popups - [DOM] Found 3 elements with non-unique id #textbar: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1621857516226,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 9:52 Uncaught TypeError: Cannot read property 'setAttribute' of null",
                "timestamp": 1621857516312,
                "type": ""
            }
        ],
        "screenShotFile": "00160074-009d-005b-00a5-0015007e00ea.png",
        "timestamp": 1621857514756,
        "duration": 1623
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004d002d-004a-00c3-009e-007f003500d6.png",
        "timestamp": 1621859964407,
        "duration": 10204
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621859976003,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621859976050,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621859976588,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621859981890,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621859981890,
                "type": ""
            }
        ],
        "screenShotFile": "006b00d7-00df-00bc-007a-001000b60049.png",
        "timestamp": 1621859974814,
        "duration": 7107
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621859984111,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621859984151,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621859984177,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621859989584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621859989584,
                "type": ""
            }
        ],
        "screenShotFile": "0088001c-008a-00e6-00e5-004000a000e9.png",
        "timestamp": 1621859982382,
        "duration": 7225
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ec003f-00eb-0096-00fa-005c007500dd.png",
        "timestamp": 1621859990063,
        "duration": 6378
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/vendor/bootstrap/js/bootstrap.min.js 5:17547 Uncaught Error: Bootstrap dropdown require Popper.js (https://popper.js.org)",
                "timestamp": 1621859998646,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 27:7 Uncaught TypeError: Cannot read property 'addEventListener' of null",
                "timestamp": 1621859998652,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://chercher.tech/practice/popups - [DOM] Found 3 elements with non-unique id #textbar: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1621859998669,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 9:52 Uncaught TypeError: Cannot read property 'setAttribute' of null",
                "timestamp": 1621859999264,
                "type": ""
            }
        ],
        "screenShotFile": "00bf0023-007e-00c1-0099-0021002200f8.png",
        "timestamp": 1621859996685,
        "duration": 2725
    },
    {
        "description": "right clicking|Right click option",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:66:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"right clicking\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:58:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:57:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/practice/popups 0:0 Uncaught SyntaxError: Unexpected end of JSON input",
                "timestamp": 1621859999983,
                "type": ""
            }
        ],
        "screenShotFile": "008300de-00e6-0053-00b0-0092004e006c.png",
        "timestamp": 1621860000043,
        "duration": 24
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13424,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d00082-0055-0095-00cc-00bb0076009e.png",
        "timestamp": 1621860087415,
        "duration": 8689
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13424,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860097429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860097663,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860097733,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860103678,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860103678,
                "type": ""
            }
        ],
        "screenShotFile": "006b00cb-00cf-0004-00bf-000300a00017.png",
        "timestamp": 1621860096424,
        "duration": 7266
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13424,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860105163,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860105197,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860105218,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860110643,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860110643,
                "type": ""
            }
        ],
        "screenShotFile": "00bd00a6-0034-00b6-0059-00a900210060.png",
        "timestamp": 1621860104024,
        "duration": 6649
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13424,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a0078-00b2-00de-002e-0056004f0063.png",
        "timestamp": 1621860111084,
        "duration": 6106
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13424,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/vendor/bootstrap/js/bootstrap.min.js 5:17547 Uncaught Error: Bootstrap dropdown require Popper.js (https://popper.js.org)",
                "timestamp": 1621860119028,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 27:7 Uncaught TypeError: Cannot read property 'addEventListener' of null",
                "timestamp": 1621860119032,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://chercher.tech/practice/popups - [DOM] Found 3 elements with non-unique id #textbar: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1621860119046,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 9:52 Uncaught TypeError: Cannot read property 'setAttribute' of null",
                "timestamp": 1621860119505,
                "type": ""
            }
        ],
        "screenShotFile": "00fa0003-0014-0094-00bc-003f00390028.png",
        "timestamp": 1621860117462,
        "duration": 2227
    },
    {
        "description": "right clicking|Right click option",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13424,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:66:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"right clicking\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:58:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:57:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/practice/popups 0:0 Uncaught SyntaxError: Unexpected end of JSON input",
                "timestamp": 1621860120126,
                "type": ""
            }
        ],
        "screenShotFile": "00c100db-0006-0060-0016-0052006a0024.png",
        "timestamp": 1621860120165,
        "duration": 13
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5000,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004c00c9-007b-00e1-0096-009b003c0072.png",
        "timestamp": 1621860286856,
        "duration": 8876
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5000,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860297005,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860297182,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860297218,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860302750,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860302750,
                "type": ""
            }
        ],
        "screenShotFile": "002200d4-0023-00a7-0038-00f800690082.png",
        "timestamp": 1621860295970,
        "duration": 6813
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5000,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860304802,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860304837,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860304864,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860310350,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860310350,
                "type": ""
            }
        ],
        "screenShotFile": "009f008b-00f3-00de-00f3-00df002200d1.png",
        "timestamp": 1621860303182,
        "duration": 7185
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5000,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008c001f-0077-00af-0033-00c800b40016.png",
        "timestamp": 1621860310779,
        "duration": 6054
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17324,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009700cc-00d1-006b-008a-003500890021.png",
        "timestamp": 1621860372377,
        "duration": 8416
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17324,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860381546,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860381742,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860381782,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860387462,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860387462,
                "type": ""
            }
        ],
        "screenShotFile": "00a20009-00d6-007f-0027-00f3004100bf.png",
        "timestamp": 1621860381035,
        "duration": 6443
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17324,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860388369,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860388371,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860388375,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860388375,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860388375,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860389099,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860389153,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860389192,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860394574,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860394574,
                "type": ""
            }
        ],
        "screenShotFile": "007c001e-0083-0074-0039-00df008b00a9.png",
        "timestamp": 1621860387765,
        "duration": 6871
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17324,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008500f0-009f-0092-0024-001700940030.png",
        "timestamp": 1621860395063,
        "duration": 6711
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17324,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Angular could not be found on the page https://chercher.tech/practice/popups. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page https://chercher.tech/practice/popups. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:46:2)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:43:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/vendor/bootstrap/js/bootstrap.min.js 5:17547 Uncaught Error: Bootstrap dropdown require Popper.js (https://popper.js.org)",
                "timestamp": 1621860404278,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 27:7 Uncaught TypeError: Cannot read property 'addEventListener' of null",
                "timestamp": 1621860404282,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://chercher.tech/practice/popups - [DOM] Found 3 elements with non-unique id #textbar: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1621860404291,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 9:52 Uncaught TypeError: Cannot read property 'setAttribute' of null",
                "timestamp": 1621860404918,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/practice/popups 0:0 Uncaught SyntaxError: Unexpected end of JSON input",
                "timestamp": 1621860404970,
                "type": ""
            }
        ],
        "screenShotFile": "00f700b7-00e1-000d-00a7-00d8008600e8.png",
        "timestamp": 1621860402048,
        "duration": 13179
    },
    {
        "description": "right clicking|Right click option",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17324,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:67:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"right clicking\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:59:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:58:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "006000bc-00bc-00f6-0023-00ec00000010.png",
        "timestamp": 1621860415609,
        "duration": 7
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11732,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003300e7-0056-003a-00a7-00e7006f00d1.png",
        "timestamp": 1621860504840,
        "duration": 8960
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11732,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860516027,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860516541,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860516604,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860522554,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860522554,
                "type": ""
            }
        ],
        "screenShotFile": "007600f3-00f8-00f4-0069-005800f200e7.png",
        "timestamp": 1621860514013,
        "duration": 8617
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11732,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860524645,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860524653,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860524656,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860524657,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860524657,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860525492,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860525512,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860525538,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860531063,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860531063,
                "type": ""
            }
        ],
        "screenShotFile": "00450067-00d5-00e9-00da-002300420095.png",
        "timestamp": 1621860523052,
        "duration": 8058
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11732,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c00bc-00e5-002e-002e-00d00018007b.png",
        "timestamp": 1621860531541,
        "duration": 6455
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11732,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Angular could not be found on the page https://chercher.tech/practice/popups. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page https://chercher.tech/practice/popups. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:46:2)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:43:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/vendor/bootstrap/js/bootstrap.min.js 5:17547 Uncaught Error: Bootstrap dropdown require Popper.js (https://popper.js.org)",
                "timestamp": 1621860540610,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 27:7 Uncaught TypeError: Cannot read property 'addEventListener' of null",
                "timestamp": 1621860540616,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://chercher.tech/practice/popups - [DOM] Found 3 elements with non-unique id #textbar: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1621860540627,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 9:52 Uncaught TypeError: Cannot read property 'setAttribute' of null",
                "timestamp": 1621860541084,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/practice/popups 0:0 Uncaught SyntaxError: Unexpected end of JSON input",
                "timestamp": 1621860541286,
                "type": ""
            }
        ],
        "screenShotFile": "006800fc-008c-00dd-0095-002100db00f4.png",
        "timestamp": 1621860538289,
        "duration": 12954
    },
    {
        "description": "right clicking|Right click option",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11732,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:69:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"right clicking\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:60:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:59:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "0005005c-0085-002d-00a2-00ce00ab0088.png",
        "timestamp": 1621860551683,
        "duration": 7
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18688,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e00ad-0072-001d-001e-002d008b0076.png",
        "timestamp": 1621860778904,
        "duration": 9133
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18688,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860789656,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860789806,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860789869,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860795779,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860795779,
                "type": ""
            }
        ],
        "screenShotFile": "005b00ae-0026-00bf-0055-006000440090.png",
        "timestamp": 1621860788310,
        "duration": 7481
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18688,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860796576,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860796582,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860796583,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860796583,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860796584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860797274,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860797302,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860797319,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860802718,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860802718,
                "type": ""
            }
        ],
        "screenShotFile": "00dd0007-00ab-00d0-0011-005e0023003c.png",
        "timestamp": 1621860796098,
        "duration": 6666
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18688,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e7008d-0053-0062-00b1-008a00380093.png",
        "timestamp": 1621860803280,
        "duration": 6899
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18688,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:58:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:46:2)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:43:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00200008-0042-000e-0059-009500080005.png",
        "timestamp": 1621860810377,
        "duration": 21
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15664,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fe00a1-0048-0009-00d6-0093006e0053.png",
        "timestamp": 1621860843512,
        "duration": 8375
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15664,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860852893,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860853056,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860853111,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860859721,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860859721,
                "type": ""
            }
        ],
        "screenShotFile": "00b7001e-00b5-003f-005d-00b70032009e.png",
        "timestamp": 1621860852228,
        "duration": 7504
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15664,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860861291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860861367,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860861399,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860866813,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860866813,
                "type": ""
            }
        ],
        "screenShotFile": "00d600ab-003c-0019-0070-0088006b00a4.png",
        "timestamp": 1621860860014,
        "duration": 6821
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15664,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000b00c3-002f-004b-002a-002c00d40027.png",
        "timestamp": 1621860867321,
        "duration": 6554
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15664,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:58:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:46:2)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:43:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "002600ea-00ca-003b-00d4-00ef00910078.png",
        "timestamp": 1621860874137,
        "duration": 20
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00690000-00c8-002b-0073-00ce005800e7.png",
        "timestamp": 1621860905719,
        "duration": 8295
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860914804,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860914973,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860915006,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860920845,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860920845,
                "type": ""
            }
        ],
        "screenShotFile": "008e008a-0041-0074-008f-0034003e00c1.png",
        "timestamp": 1621860914266,
        "duration": 6587
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621860923462,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860923575,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621860923604,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860929064,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621860929064,
                "type": ""
            }
        ],
        "screenShotFile": "00e900f1-004d-0072-009f-005e00b60078.png",
        "timestamp": 1621860921214,
        "duration": 7879
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00140013-00f5-0022-009f-00ba009e0082.png",
        "timestamp": 1621860929626,
        "duration": 6971
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:58:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:46:2)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:43:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "005a0002-00ab-0034-007a-009a006d00ab.png",
        "timestamp": 1621860936818,
        "duration": 20
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12504,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e00aa-00d5-00de-00e0-006700090059.png",
        "timestamp": 1621862755306,
        "duration": 10141
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12504,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621862766234,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621862766385,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621862766426,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621862772115,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621862772115,
                "type": ""
            }
        ],
        "screenShotFile": "00e30080-0063-0026-0006-00b300a6007f.png",
        "timestamp": 1621862765779,
        "duration": 6354
    },
    {
        "description": "Validate url|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12504,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://angular.io/ - ::-webkit-details-marker pseudo element selector is deprecated. Please use ::marker instead. See https://chromestatus.com/feature/6730096436051968 for more details.",
                "timestamp": 1621862773877,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/navigation.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621862773953,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/polyfills-es2015.6cdad74b82093d603319.js 0 A preload for 'https://angular.io/generated/docs/index.json' is found, but is not used because the request headers do not match.",
                "timestamp": 1621862773974,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/docs/index.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621862779444,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://angular.io/ - The resource https://angular.io/generated/navigation.json was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
                "timestamp": 1621862779444,
                "type": ""
            }
        ],
        "screenShotFile": "00890034-0011-0003-00d0-0017000d008c.png",
        "timestamp": 1621862772608,
        "duration": 6864
    },
    {
        "description": "Validate title|mySuite",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12504,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008c0009-00e1-0014-000e-00fc006b0030.png",
        "timestamp": 1621862779946,
        "duration": 6405
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12504,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:58:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:46:2)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\FirtsTestSpect.js:43:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c6003d-006e-0075-002e-006a00d80011.png",
        "timestamp": 1621862786696,
        "duration": 24
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6244,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:16:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:4:2)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bf00d7-00de-0046-001b-0092005600d9.png",
        "timestamp": 1621862869750,
        "duration": 33
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15660,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:16:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:3:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "001e0079-00cd-00a7-00db-007800870066.png",
        "timestamp": 1621863123008,
        "duration": 30
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3760,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:16:48)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:3:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "001b00f8-0046-0067-004b-009300ef006a.png",
        "timestamp": 1621863581449,
        "duration": 43
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17476,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/vendor/bootstrap/js/bootstrap.min.js 5:17547 Uncaught Error: Bootstrap dropdown require Popper.js (https://popper.js.org)",
                "timestamp": 1621863951227,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 27:7 Uncaught TypeError: Cannot read property 'addEventListener' of null",
                "timestamp": 1621863951232,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://chercher.tech/practice/popups - [DOM] Found 3 elements with non-unique id #textbar: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1621863951241,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/js/index8.js 9:52 Uncaught TypeError: Cannot read property 'setAttribute' of null",
                "timestamp": 1621863951602,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://chercher.tech/practice/popups 0:0 Uncaught SyntaxError: Unexpected end of JSON input",
                "timestamp": 1621863956850,
                "type": ""
            }
        ],
        "screenShotFile": "003d000f-00fb-00d2-00bf-00c5004400c2.png",
        "timestamp": 1621863948512,
        "duration": 8320
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20092,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:19:85)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:3:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ad002a-00dc-006c-00b0-007e00ae00cc.png",
        "timestamp": 1621864160860,
        "duration": 42
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 19272,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: Protractor is not defined"
        ],
        "trace": [
            "ReferenceError: Protractor is not defined\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:19:65)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:3:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "0059005d-003b-006c-00db-0000000800e6.png",
        "timestamp": 1621864289038,
        "duration": 42
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13612,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: browser.actions(...).contextClick is not a function"
        ],
        "trace": [
            "TypeError: browser.actions(...).contextClick is not a function\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:19:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:3:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "006000c0-000c-000a-007a-0080005c0041.png",
        "timestamp": 1621924474258,
        "duration": 71
    },
    {
        "description": "Mouse Operations|Protractor Typescript Demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18180,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: browser.actions(...).contextClick is not a function"
        ],
        "trace": [
            "TypeError: browser.actions(...).contextClick is not a function\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:19:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Mouse Operations\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:3:5)\n    at addSpecsToSuite (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\myusuf\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\myusuf\\Documents\\ProtractorTestSeries\\TestCases\\MouseActions.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b10013-0038-0053-0047-001f00da0052.png",
        "timestamp": 1621924485681,
        "duration": 42
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
