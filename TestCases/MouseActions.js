describe("Protractor Typescript Demo", function() 
{
    it("Mouse Operations", function() 
    {
        browser.ignoreSynchronization = true; // for non-angular websites
        // set implicit time to 30 seconds
		browser.manage().timeouts().implicitlyWait(30000);

		browser.get("https://chercher.tech/practice/popups");
       // browser.waitForAngularEnabled(false);
        browser.manage().window().maximize();
		// mouse hover on a submenu
		browser.actions().mouseMove(element(by.id("sub-menu"))).perform();
        browser.sleep(5000);

        //browser.close();
        //var rightClickBtn  = element(by.xpath("//input[@id = 'double-click']"));
    
        browser.actions().contextClick(element(by.id("double-click"))).perform();
        browser.sleep(5000);
	});
});
/*
describe("Right click option", function(){
    it("right clicking", function(){
    //browser.ignoreSynchronization = true; // for non-angular websites
    browser.manage().timeouts().implicitlyWait(30000);

		browser.get("https://chercher.tech/practice/popups");
        browser.waitForAngularEnabled(false);
        browser.manage().window().maximize();
        var rightClickBtn  = element(by.xpath("//input[@id = 'double-click']"));
    
        browser.actions().click(rightClickBtn, Protractor.Button.RIGHT).perform();
        browser.sleep(5000);
    });

});*/