describe("mySuite", function(){
    
    it("Validate url", function()
    {
        browser.get('https://angularjs.org/');
        browser.sleep(5000);
        browser.manage().window().maximize();
        expect(browser.getCurrentUrl()).toBe('https://angularjs.org/');

    });

    it("Validate title", function()
    {
        browser.get('https://angular.io/');
        browser.sleep(5000);
        browser.manage().window().maximize();
        expect(browser.getTitle()).toBe('Angular');

    });
});

describe("mySuite", function(){
    
    it("Validate url", function()
    {
        browser.get('https://angular.io/');
        browser.sleep(5000);
        browser.manage().window().maximize();
        expect(browser.getCurrentUrl()).toBe('https://angular.io/');

    });

    it("Validate title", function()
    {
        browser.get('https://angularjs.org/');
        browser.sleep(5000);
        browser.manage().window().maximize();
        expect(browser.getTitle()).toBe('AngularJS — Superheroic JavaScript MVW Framework');

    });
});

